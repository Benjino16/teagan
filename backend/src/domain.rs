mod activity;
mod date;
mod fact;
mod group;
mod open_point;
mod person;
mod photo;
mod search;
mod token;
mod totp;
mod user;

pub use activity::{
    ActivityGroupInput, ActivityGroupResponse, ActivityInput, ActivityResponse, ParticipantInput,
    ParticipantResponse,
};
pub use fact::{FactInput, FactLabelResponse, FactOrderInput, FactResponse, count_fact_labels};
pub use group::{GroupArchivedInput, GroupInput, GroupResponse, MembershipResponse};
pub use open_point::{NewOpenPointInput, OpenPointDoneInput, OpenPointInput, OpenPointResponse};
pub use person::{PersonArchivedInput, PersonInput, PersonResponse};
pub use photo::{
    MAX_PARALLEL_PHOTOS, MAX_UPLOAD_BYTES, PhotoSize, PhotoUrls, ProcessedPhoto, process_photo,
};
pub use search::{Hits, SearchParams, SearchQuery, SearchResponse, best_hits};
pub use token::{hash_token, new_token};
pub use totp::{
    hash_recovery_code, is_totp_code, new_recovery_codes, new_totp_secret, normalize_code,
    totp_setup, totp_step,
};
pub use user::{
    ChangePasswordInput, LoginInput, NewUserInput, PasswordInput, hash_password, validate_username,
    verify_password,
};

/// Trims the text and turns an empty result into `None`.
fn trimmed_or_none(value: Option<String>) -> Option<String> {
    value
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}
