/** Placeholder for panels not built yet. */
export function Offline({ name }: { name: string }) {
  return (
    <div className="offline">
      <p className="offline__title">{name}</p>
      <p>MODULE OFFLINE. AWAITING VAULT-TEC FIRMWARE UPDATE.</p>
    </div>
  )
}
