export type NotificationMessage = {
  subject: string;
  body: string;
  target?: string;
};

export type ProviderSendResult = {
  providerMessageId: string;
};

export interface NotificationProvider {
  send(message: NotificationMessage): Promise<ProviderSendResult>;
}

export type NotificationProviderMap = {
  email?: NotificationProvider;
  slack?: NotificationProvider;
};
