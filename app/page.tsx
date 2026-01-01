import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export default async function Home() {
  const { userId } = await auth()

  // Redirect logged-in users to dashboard
  if (userId) {
    redirect("/dashboard")
  }

  // Redirect logged-out users to login
  redirect("/login")
}

