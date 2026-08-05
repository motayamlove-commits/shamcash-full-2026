// AutoMigrator is no longer needed - using Firebase instead of Supabase
// This component is now a pass-through
export default function AutoMigrator({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
