//! Brake on password guessing: failed logins are counted per
//! username and per network address within a sliding window. In memory only –
//! a restart forgets it, which is fine for slowing down guessing.

use std::{
    collections::{HashMap, VecDeque},
    net::{IpAddr, Ipv6Addr},
    sync::Mutex,
    time::{Duration, Instant},
};

const WINDOW: Duration = Duration::from_secs(15 * 60);
const MAX_PER_USERNAME: usize = 10;
/// Higher, since behind a reverse proxy everyone shares one address.
const MAX_PER_ADDRESS: usize = 30;
/// Above this many keys, expired ones are swept out on the next attempt.
const SWEEP_ABOVE: usize = 1000;

#[derive(Clone, PartialEq, Eq, Hash)]
enum Key {
    Username(String),
    Address(IpAddr),
}

#[derive(Default)]
pub struct LoginLimiter {
    attempts: Mutex<HashMap<Key, VecDeque<Instant>>>,
}

impl LoginLimiter {
    /// Counts a login attempt *before* the password is checked – otherwise many
    /// parallel requests would all get through before the first one fails.
    /// `Err(wait)` if the username or the address has used up its attempts.
    pub fn begin(&self, username: &str, address: IpAddr, now: Instant) -> Result<(), Duration> {
        let mut attempts = self.attempts.lock().unwrap_or_else(|err| err.into_inner());
        if attempts.len() > SWEEP_ABOVE {
            attempts.retain(|_, times| {
                forget_old(times, now);
                !times.is_empty()
            });
        }

        let keys = [
            (Key::Username(username.to_string()), MAX_PER_USERNAME),
            (Key::Address(network(address)), MAX_PER_ADDRESS),
        ];
        let wait = keys
            .iter()
            .filter_map(|(key, max)| {
                let times = attempts.get_mut(key)?;
                forget_old(times, now);
                // Free again once enough of the oldest attempts have left the window
                (times.len() >= *max)
                    .then(|| (times[times.len() - max] + WINDOW).saturating_duration_since(now))
            })
            .max();
        if let Some(wait) = wait {
            return Err(wait);
        }

        for (key, _) in keys {
            attempts.entry(key).or_default().push_back(now);
        }
        Ok(())
    }

    /// The login worked: the username starts fresh, the address gets back the
    /// attempt counted in `begin`.
    pub fn succeeded(&self, username: &str, address: IpAddr) {
        let mut attempts = self.attempts.lock().unwrap_or_else(|err| err.into_inner());
        attempts.remove(&Key::Username(username.to_string()));
        if let Some(times) = attempts.get_mut(&Key::Address(network(address))) {
            times.pop_back();
        }
    }
}

fn forget_old(times: &mut VecDeque<Instant>, now: Instant) {
    while times
        .front()
        .is_some_and(|&time| now.saturating_duration_since(time) >= WINDOW)
    {
        times.pop_front();
    }
}

/// IPv6 counts per /64 – one connection usually has a whole /64 and could
/// switch addresses at will. IPv4 inside IPv6 (`::ffff:1.2.3.4`) counts as IPv4.
fn network(address: IpAddr) -> IpAddr {
    match address {
        IpAddr::V4(_) => address,
        IpAddr::V6(v6) => match v6.to_ipv4_mapped() {
            Some(v4) => IpAddr::V4(v4),
            None => IpAddr::V6(Ipv6Addr::from_bits(v6.to_bits() & (u128::MAX << 64))),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ip(text: &str) -> IpAddr {
        text.parse().unwrap()
    }

    /// `count` failed attempts, one second apart, starting at `start`.
    fn fail(limiter: &LoginLimiter, username: &str, address: IpAddr, start: Instant, count: u64) {
        for i in 0..count {
            limiter
                .begin(username, address, start + Duration::from_secs(i))
                .unwrap();
        }
    }

    #[test]
    fn username_is_blocked_after_ten_failures_until_the_oldest_expires() {
        let limiter = LoginLimiter::default();
        let start = Instant::now();
        fail(&limiter, "ben", ip("10.0.0.1"), start, 10);

        let later = start + Duration::from_secs(60);
        assert_eq!(
            limiter.begin("ben", ip("10.0.0.2"), later),
            Err(WINDOW - Duration::from_secs(60))
        );
        // Other usernames from the same address still work
        assert!(limiter.begin("mira", ip("10.0.0.1"), later).is_ok());
        // Once the first attempt is 15 minutes old, one more is allowed
        assert!(limiter.begin("ben", ip("10.0.0.2"), start + WINDOW).is_ok());
        assert!(
            limiter
                .begin("ben", ip("10.0.0.2"), start + WINDOW)
                .is_err()
        );
    }

    #[test]
    fn address_is_blocked_after_thirty_failures_across_usernames() {
        let limiter = LoginLimiter::default();
        let start = Instant::now();
        for i in 0..30 {
            limiter
                .begin(&format!("user{i}"), ip("10.0.0.1"), start)
                .unwrap();
        }
        assert!(limiter.begin("ben", ip("10.0.0.1"), start).is_err());
        assert!(limiter.begin("ben", ip("10.0.0.2"), start).is_ok());
    }

    #[test]
    fn success_resets_the_username_and_returns_the_address_attempt() {
        let limiter = LoginLimiter::default();
        let start = Instant::now();
        fail(&limiter, "ben", ip("10.0.0.1"), start, 9);
        limiter.begin("ben", ip("10.0.0.1"), start).unwrap();
        limiter.succeeded("ben", ip("10.0.0.1"));
        fail(&limiter, "ben", ip("10.0.0.1"), start, 10);
        assert!(limiter.begin("ben", ip("10.0.0.1"), start).is_err());
    }

    #[test]
    fn ipv6_counts_per_64_and_mapped_ipv4_as_ipv4() {
        assert_eq!(network(ip("2001:db8:1:2:aaaa::1")), ip("2001:db8:1:2::"));
        assert_eq!(network(ip("2001:db8:1:2:bbbb::9")), ip("2001:db8:1:2::"));
        assert_ne!(network(ip("2001:db8:1:3::1")), ip("2001:db8:1:2::"));
        assert_eq!(network(ip("::ffff:192.168.1.5")), ip("192.168.1.5"));
    }

    #[test]
    fn expired_keys_are_swept_once_there_are_many() {
        let limiter = LoginLimiter::default();
        let start = Instant::now();
        for i in 0..=SWEEP_ABOVE {
            limiter
                .begin(
                    &format!("user{i}"),
                    ip(&format!("10.0.{}.{}", i / 250, i % 250)),
                    start,
                )
                .unwrap();
        }
        limiter
            .begin("ben", ip("10.9.9.9"), start + WINDOW)
            .unwrap();
        assert_eq!(limiter.attempts.lock().unwrap().len(), 2);
    }
}
