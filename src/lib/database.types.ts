export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Timestamps = { created_at: string };

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          job_title: string | null;
          phone: string | null;
          user_role: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          job_title?: string | null;
          phone?: string | null;
          user_role?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
          job_title?: string | null;
          phone?: string | null;
          user_role?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      farms: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          region: string | null;
          commune: string | null;
          context: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by: string;
          region?: string | null;
          commune?: string | null;
          context?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          region?: string | null;
          commune?: string | null;
          context?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      farm_memberships: {
        Row: {
          id: string;
          farm_id: string;
          user_id: string;
          role: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          farm_id: string;
          user_id: string;
          role: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          role?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "farm_memberships_farm_id_fkey";
            columns: ["farm_id"];
            isOneToOne: false;
            referencedRelation: "farms";
            referencedColumns: ["id"];
          },
        ];
      };
      blocks: {
        Row: Timestamps & {
          id: string;
          farm_id: string;
          code: string;
          name: string | null;
          species: string | null;
          variety: string | null;
          rootstock: string | null;
          planting_year: number | null;
          density: number | null;
          area_ha: number | null;
          irrigation: string | null;
          geometry: Json | null;
          source: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "blocks_farm_id_fkey";
            columns: ["farm_id"];
            isOneToOne: false;
            referencedRelation: "farms";
            referencedColumns: ["id"];
          },
        ];
      };
      farm_imports: {
        Row: Timestamps & {
          id: string;
          farm_id: string;
          source_type: "cartografia" | "planilla";
          file_name: string | null;
          row_count: number;
          valid_count: number;
          warning_count: number;
          error_count: number;
          quality_score: number | null;
          mapping: Json;
          issues: Json;
          created_by: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      farm_invitations: {
        Row: Timestamps & {
          id: string;
          farm_id: string;
          email: string;
          full_name: string | null;
          role: "administrador" | "agronomo" | "muestreador";
          status: "pending" | "accepted" | "revoked";
          invited_by: string | null;
          user_id: string | null;
          accepted_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      block_assignments: {
        Row: Timestamps & {
          id: string;
          farm_id: string;
          block_id: string;
          invitation_id: string | null;
          user_id: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "block_assignments_block_id_fkey";
            columns: ["block_id"];
            isOneToOne: false;
            referencedRelation: "blocks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "block_assignments_farm_id_fkey";
            columns: ["farm_id"];
            isOneToOne: false;
            referencedRelation: "farms";
            referencedColumns: ["id"];
          },
        ];
      };
      onboarding_sessions: {
        Row: {
          id: string;
          user_id: string;
          status: "in_progress" | "completed";
          current_step: string;
          data: Json;
          farm_id: string | null;
          rating: number | null;
          feedback: string | null;
          diagnostic: Json | null;
          started_at: string;
          updated_at: string;
          completed_at: string | null;
          duration_seconds: number | null;
        };
        Insert: {
          id?: string;
          user_id?: string;
          status?: "in_progress";
          current_step?: string;
          data?: Json;
        };
        Update: {
          current_step?: string;
          data?: Json;
          rating?: number | null;
          feedback?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      onboarding_events: {
        Row: {
          id: number;
          session_id: string;
          user_id: string;
          step: string;
          event: "step_view" | "step_complete" | "step_skip" | "completed" | "resumed" | "micro_survey";
          metadata: Json;
          created_at: string;
        };
        Insert: {
          session_id: string;
          user_id?: string;
          step: string;
          event: "step_view" | "step_complete" | "step_skip" | "resumed" | "micro_survey";
          metadata?: Json;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      complete_onboarding: {
        Args: { p_session_id: string };
        Returns: string;
      };
      get_farm_team: {
        Args: { p_farm_id: string };
        Returns: Array<{
          kind: "member" | "invitation";
          user_id: string | null;
          full_name: string | null;
          email: string | null;
          role: string;
          status: string;
          block_codes: string[];
        }>;
      };
      save_diagnostic: {
        Args: { p_session_id: string; p_diagnostic: Json };
        Returns: undefined;
      };
      onboarding_metrics: {
        Args: Record<string, never>;
        Returns: Json;
      };
      is_farm_member: {
        Args: { p_farm_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type OnboardingMetrics = {
  diagnosticsCount: number;
  avgMaturityScore: number | null;
  /** nivel ("inicial" | "en_desarrollo" | "avanzado") -> cantidad */
  maturityLevels: Record<string, number>;
  /** id de dimensión (ver DIAGNOSTIC_QUESTIONS) -> puntaje promedio 0-100 */
  maturityByDimension: Record<string, number>;
  /** hito -> promedio de estrellas de la microencuesta */
  microSurveys: Record<string, { avgRating: number | null; count: number }>;
  sessionsStarted: number;
  sessionsCompleted: number;
  sessionsInProgress: number;
  avgDurationSeconds: number | null;
  medianDurationSeconds: number | null;
  under10MinRate: number | null;
  avgRating: number | null;
  ratingsCount: number;
  avgQualityScore: number | null;
  farms: number;
  blocks: number;
  invitations: number;
  invitationsAccepted: number;
  stepFunnel: Record<string, number>;
  stepCompleted: Record<string, number>;
  stepSkips: Record<string, number>;
  abandonedByStep: Record<string, number>;
};
