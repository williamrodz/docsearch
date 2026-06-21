export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      groups: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
          created_by?: string | null
        }
      }
      images: {
        Row: {
          id: string
          group_id: string
          filename: string
          storage_path: string
          sort_order: number | null
          created_at: string
          processing_status: 'pending' | 'processing' | 'completed' | 'failed'
          processed_at: string | null
          raw_text: string | null
          confidence_score: number | null
          alternatives: Json | null
          event_date: string | null
          event_date_raw: string | null
          event_date_confidence: number | null
        }
        Insert: {
          id?: string
          group_id: string
          filename: string
          storage_path: string
          sort_order?: number | null
          created_at?: string
          processing_status?: 'pending' | 'processing' | 'completed' | 'failed'
          processed_at?: string | null
          raw_text?: string | null
          confidence_score?: number | null
          alternatives?: Json | null
          event_date?: string | null
          event_date_raw?: string | null
          event_date_confidence?: number | null
        }
        Update: {
          id?: string
          group_id?: string
          filename?: string
          storage_path?: string
          sort_order?: number | null
          created_at?: string
          processing_status?: 'pending' | 'processing' | 'completed' | 'failed'
          processed_at?: string | null
          raw_text?: string | null
          confidence_score?: number | null
          alternatives?: Json | null
          event_date?: string | null
          event_date_raw?: string | null
          event_date_confidence?: number | null
        }
      }
      people: {
        Row: {
          id: string
          image_id: string
          name: string
          name_normalized: string
          role: string | null
          confidence: number | null
          alternatives: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          image_id: string
          name: string
          name_normalized: string
          role?: string | null
          confidence?: number | null
          alternatives?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          image_id?: string
          name?: string
          name_normalized?: string
          role?: string | null
          confidence?: number | null
          alternatives?: Json | null
          created_at?: string
        }
      }
      canonical_people: {
        Row: {
          id: string
          group_id: string
          canonical_name: string
          variant_names: string[]
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          canonical_name: string
          variant_names?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          canonical_name?: string
          variant_names?: string[]
          created_at?: string
        }
      }
      people_canonical_link: {
        Row: {
          person_id: string
          canonical_id: string
          match_score: number | null
        }
        Insert: {
          person_id: string
          canonical_id: string
          match_score?: number | null
        }
        Update: {
          person_id?: string
          canonical_id?: string
          match_score?: number | null
        }
      }
      inspections: {
        Row: {
          id: string
          image_id: string
          user_id: string
          inspected_at: string
          notes: string | null
        }
        Insert: {
          id?: string
          image_id: string
          user_id: string
          inspected_at?: string
          notes?: string | null
        }
        Update: {
          id?: string
          image_id?: string
          user_id?: string
          inspected_at?: string
          notes?: string | null
        }
      }
      user_group_position: {
        Row: {
          user_id: string
          group_id: string
          last_image_id: string | null
          updated_at: string
        }
        Insert: {
          user_id: string
          group_id: string
          last_image_id?: string | null
          updated_at?: string
        }
        Update: {
          user_id?: string
          group_id?: string
          last_image_id?: string | null
          updated_at?: string
        }
      }
      processing_jobs: {
        Row: {
          id: string
          group_id: string
          created_by: string | null
          status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
          retry_failed: boolean
          total_images: number
          processed_count: number
          failed_count: number
          batch_size: number
          started_at: string | null
          completed_at: string | null
          last_activity_at: string | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          created_by?: string | null
          status?: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
          retry_failed?: boolean
          total_images?: number
          processed_count?: number
          failed_count?: number
          batch_size?: number
          started_at?: string | null
          completed_at?: string | null
          last_activity_at?: string | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          created_by?: string | null
          status?: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
          retry_failed?: boolean
          total_images?: number
          processed_count?: number
          failed_count?: number
          batch_size?: number
          started_at?: string | null
          completed_at?: string | null
          last_activity_at?: string | null
          error_message?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Convenience types
export type User = Database['public']['Tables']['users']['Row']
export type Group = Database['public']['Tables']['groups']['Row']
export type Image = Database['public']['Tables']['images']['Row']
export type Person = Database['public']['Tables']['people']['Row']
export type CanonicalPerson = Database['public']['Tables']['canonical_people']['Row']
export type Inspection = Database['public']['Tables']['inspections']['Row']
export type UserGroupPosition = Database['public']['Tables']['user_group_position']['Row']
export type ProcessingJob = Database['public']['Tables']['processing_jobs']['Row']

// Insert types
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type GroupInsert = Database['public']['Tables']['groups']['Insert']
export type ImageInsert = Database['public']['Tables']['images']['Insert']
export type PersonInsert = Database['public']['Tables']['people']['Insert']
export type InspectionInsert = Database['public']['Tables']['inspections']['Insert']

// Processing status type
export type ProcessingStatus = Image['processing_status']

// Alternative reading for uncertain text
export interface TextAlternative {
  text: string
  confidence: number
}

// Person with alternatives
export interface PersonAlternative {
  name: string
  confidence: number
}
