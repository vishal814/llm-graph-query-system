export const schemaDescription = `
Nodes:
- Customer [id, name, group]
- SalesOrder [id, creationDate, totalNetAmount, currency]
- SalesOrderItem [id, requestedQuantity, netAmount]
- Material [id]
- DeliveryDocument [id, creationDate, shippingPoint, status]
- DeliveryItem [id, actualDeliveryQuantity]
- BillingDocument [id, creationDate, totalNetAmount, currency]
- BillingItem [id, billingQuantity, netAmount]
- JournalEntry [id, amount, currency, postingDate]

Relationships:
- (SalesOrder)-[:SOLD_TO]->(Customer)
- (SalesOrder)-[:HAS_ITEM]->(SalesOrderItem)
- (SalesOrderItem)-[:IS_MATERIAL]->(Material)
- (DeliveryDocument)-[:HAS_ITEM]->(DeliveryItem)
- (DeliveryItem)-[:DELIVERS_ITEM]->(SalesOrderItem)
- (BillingDocument)-[:HAS_ITEM]->(BillingItem)
- (BillingDocument)-[:BILLED_TO]->(Customer)
- (BillingItem)-[:BILLS_FOR_ITEM]->(DeliveryItem)
- (JournalEntry)-[:ACCOUNTING_FOR]->(BillingDocument)
`;
