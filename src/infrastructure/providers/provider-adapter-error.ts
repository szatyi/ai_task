export class ProviderAdapterError extends Error {
  constructor(
    message: string,
    public readonly providerName: "email" | "slack",
    public readonly category: "transient" | "permanent",
    public readonly providerCode: string | null,
  ) {
    super(message);
  }
}
