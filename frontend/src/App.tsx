import { RouterProvider } from 'react-router'
import { AuthGate } from './app/AuthGate'
import { router } from './app/router'
import { RepositoryProvider } from './data/RepositoryProvider'
import { HttpRepository } from './data/httpRepository'

const repository = new HttpRepository()

function App() {
  return (
    <RepositoryProvider repository={repository}>
      <AuthGate>
        <RouterProvider router={router} />
      </AuthGate>
    </RepositoryProvider>
  )
}

export default App
