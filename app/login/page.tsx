import { SignIn } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export default async function LoginPage() {
  const { userId } = await auth()

  // Redirect to dashboard if already logged in
  if (userId) {
    redirect("/dashboard")
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-md w-full">
        <div className="flex justify-center">
          <SignIn
            afterSignInUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: "mx-auto",
              },
            }}
          />
        </div>
      </div>
    </main>
  )
}

