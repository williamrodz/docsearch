"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import type { User } from "@/lib/types/database"

interface UserContextType {
  currentUser: User | null
  users: User[]
  isLoading: boolean
  setCurrentUser: (user: User) => void
  createUser: (name: string) => Promise<User>
  refreshUsers: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

const LOCAL_STORAGE_KEY = "docsearch-current-user-id"

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<User | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refreshUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/users")
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
        return data.users || []
      }
    } catch (error) {
      console.error("Failed to fetch users:", error)
    }
    return []
  }, [])

  useEffect(() => {
    async function init() {
      setIsLoading(true)
      const fetchedUsers = await refreshUsers()

      // Try to restore user from localStorage
      const savedUserId = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (savedUserId && fetchedUsers.length > 0) {
        const savedUser = fetchedUsers.find((u: User) => u.id === savedUserId)
        if (savedUser) {
          setCurrentUserState(savedUser)
        }
      }

      setIsLoading(false)
    }

    init()
  }, [refreshUsers])

  const setCurrentUser = useCallback((user: User) => {
    setCurrentUserState(user)
    localStorage.setItem(LOCAL_STORAGE_KEY, user.id)
  }, [])

  const createUser = useCallback(async (name: string): Promise<User> => {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to create user")
    }

    const data = await response.json()
    const newUser = data.user

    setUsers(prev => [...prev, newUser])
    setCurrentUser(newUser)

    return newUser
  }, [setCurrentUser])

  return (
    <UserContext.Provider
      value={{
        currentUser,
        users,
        isLoading,
        setCurrentUser,
        createUser,
        refreshUsers,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}
