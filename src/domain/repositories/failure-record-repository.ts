export interface FailureRecord {
  id: string;
  deliveryId: string;
  failureType: string;
  providerName: string;
  errorMessage: string;
  errorCode: string | null;
  failurePayloadJson: string | null;
  createdAt: string;
}

export interface FailureRecordRepository {
  create(failureRecord: FailureRecord): Promise<void>;
  findByDeliveryId(deliveryId: string): Promise<FailureRecord | null>;
}
