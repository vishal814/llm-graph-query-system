import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { driver } from '../config/neo4j.js';

const DATA_DIR = path.join(__dirname, '../../../datasets');

async function processJsonlFile(filePath: string, processLine: (data: any, session: any) => Promise<void>) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const session = driver.session();
    let count = 0;
    try {
        for await (const line of rl) {
            if (!line.trim()) continue;
            const data = JSON.parse(line);
            await processLine(data, session);
            count++;
            if (count % 500 === 0) console.log(`Processed ${count} lines from ${path.basename(filePath)}`);
        }
    } finally {
        await session.close();
    }
    console.log(`Finished ${filePath}! Total: ${count}`);
}

async function ingestDirectory(dirName: string, processFn: (data: any, session: any) => Promise<void>) {
    const dir = path.join(DATA_DIR, dirName);
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith('.jsonl')) continue;
        await processJsonlFile(path.join(dir, file), processFn);
    }
}

async function main() {
    try {
        console.log("Clearing existing Graph Database...");
        const wipeSession = driver.session();
        await wipeSession.run('MATCH (n) DETACH DELETE n');
        await wipeSession.close();

        // Business Partners
        console.log("Ingesting Business Partners...");
        await ingestDirectory('business_partners', async (data, session) => {
            await session.run(`
                MERGE (c:Customer {id: $id})
                SET c.name = $name, c.group = $group
            `, { id: data.businessPartner, name: data.businessPartnerName || '', group: data.businessPartnerGroup || '' });
        });

        // Sales Orders
        console.log("Ingesting Sales Orders...");
        await ingestDirectory('sales_order_headers', async (data, session) => {
            await session.run(`
                MERGE (o:SalesOrder {id: $id})
                SET o.creationDate = $creationDate, o.totalNetAmount = $totalNetAmount, o.currency = $currency
                WITH o
                MATCH (c:Customer {id: $soldToParty})
                MERGE (o)-[:SOLD_TO]->(c)
            `, {
                id: data.salesOrder, creationDate: data.creationDate,
                totalNetAmount: parseFloat(data.totalNetAmount) || 0, currency: data.transactionCurrency,
                soldToParty: data.soldToParty
            });
        });

        // Sales Order Items
        console.log("Ingesting Sales Order Items...");
        await ingestDirectory('sales_order_items', async (data, session) => {
            const itemId = `${data.salesOrder}-${parseInt(data.salesOrderItem, 10)}`;
            await session.run(`
                MERGE (i:SalesOrderItem {id: $itemId})
                SET i.requestedQuantity = $requestedQuantity, i.netAmount = $netAmount
                MERGE (o:SalesOrder {id: $salesOrder})
                MERGE (o)-[:HAS_ITEM]->(i)
                MERGE (m:Material {id: $material})
                MERGE (i)-[:IS_MATERIAL]->(m)
            `, {
                itemId, salesOrder: data.salesOrder,
                requestedQuantity: parseFloat(data.requestedQuantity) || 0,
                netAmount: parseFloat(data.netAmount) || 0, material: data.material
            });
        });

        // Delivery Headers
        console.log("Ingesting Delivery Headers...");
        await ingestDirectory('outbound_delivery_headers', async (data, session) => {
            await session.run(`
                MERGE (d:DeliveryDocument {id: $id})
                SET d.creationDate = $creationDate, d.shippingPoint = $shippingPoint, d.status = $status
            `, {
                id: data.deliveryDocument, creationDate: data.creationDate,
                shippingPoint: data.shippingPoint, status: data.overallGoodsMovementStatus
            });
        });

        // Delivery Items
        console.log("Ingesting Delivery Items...");
        await ingestDirectory('outbound_delivery_items', async (data, session) => {
            const itemId = `${data.deliveryDocument}-${parseInt(data.deliveryDocumentItem, 10)}`;
            const refSalesItemId = `${data.referenceSdDocument}-${parseInt(data.referenceSdDocumentItem, 10)}`;
            await session.run(`
                MERGE (di:DeliveryItem {id: $itemId})
                SET di.actualDeliveryQuantity = $qty
                MERGE (d:DeliveryDocument {id: $deliveryId})
                MERGE (d)-[:HAS_ITEM]->(di)
                WITH di
                MATCH (si:SalesOrderItem {id: $refSalesItemId})
                MERGE (di)-[:DELIVERS_ITEM]->(si)
            `, {
                itemId, qty: parseFloat(data.actualDeliveryQuantity) || 0,
                deliveryId: data.deliveryDocument, refSalesItemId
            });
            if (data.plant) {
                await session.run(`
                    MERGE (di:DeliveryItem {id: $itemId})
                    MERGE (pl:Plant {id: $plantId})
                    MERGE (di)-[:SHIPPED_FROM]->(pl)
                `, { itemId, plantId: data.plant });
            }
        });

        // Billing Documents
        console.log("Ingesting Billing Documents...");
        await ingestDirectory('billing_document_headers', async (data, session) => {
            await session.run(`
                MERGE (b:BillingDocument {id: $id})
                SET b.creationDate = $creationDate, b.totalNetAmount = $totalNetAmount, b.currency = $currency
                WITH b
                MATCH (c:Customer {id: $soldToParty})
                MERGE (b)-[:BILLED_TO]->(c)
            `, {
                id: data.billingDocument, creationDate: data.creationDate,
                totalNetAmount: parseFloat(data.totalNetAmount) || 0, currency: data.transactionCurrency,
                soldToParty: data.soldToParty
            });
        });

        // Billing Items
        console.log("Ingesting Billing Items...");
        await ingestDirectory('billing_document_items', async (data, session) => {
            const itemId = `${data.billingDocument}-${parseInt(data.billingDocumentItem, 10)}`;
            const refDeliveryItemId = `${data.referenceSdDocument}-${parseInt(data.referenceSdDocumentItem, 10)}`;
            await session.run(`
                MERGE (bi:BillingItem {id: $itemId})
                SET bi.billingQuantity = $qty, bi.netAmount = $netAmount
                MERGE (b:BillingDocument {id: $billingId})
                MERGE (b)-[:HAS_ITEM]->(bi)
                WITH bi
                MATCH (di:DeliveryItem {id: $refDeliveryItemId})
                MERGE (bi)-[:BILLS_FOR_ITEM]->(di)
            `, {
                itemId, qty: parseFloat(data.billingQuantity) || 0, netAmount: parseFloat(data.netAmount) || 0,
                billingId: data.billingDocument, refDeliveryItemId
            });
        });

        // Journal Entries
        console.log("Ingesting Journal Entries...");
        await ingestDirectory('journal_entry_items_accounts_receivable', async (data, session) => {
            await session.run(`
                MERGE (j:JournalEntry {id: $id})
                SET j.amount = $amount, j.currency = $currency, j.postingDate = $date
                WITH j
                MATCH (b:BillingDocument {id: $refDoc})
                MERGE (j)-[:ACCOUNTING_FOR]->(b)
            `, {
                id: data.accountingDocument, amount: parseFloat(data.amountInTransactionCurrency) || 0,
                currency: data.transactionCurrency, date: data.postingDate, refDoc: data.referenceDocument
            });
        });

        // Products
        console.log("Ingesting Products...");
        await ingestDirectory('products', async (data, session) => {
            await session.run(`
                MERGE (p:Product {id: $id})
                SET p.productType = $productType, p.industrySector = $industrySector,
                    p.grossWeight = $grossWeight, p.netWeight = $netWeight, p.weightUnit = $weightUnit,
                    p.productGroup = $productGroup, p.division = $division
            `, {
                id: data.product, productType: data.productType || '',
                industrySector: data.industrySector || '',
                grossWeight: parseFloat(data.grossWeight) || 0,
                netWeight: parseFloat(data.netWeight) || 0,
                weightUnit: data.weightUnit || '',
                productGroup: data.productGroup || '',
                division: data.division || ''
            });
        });

        // Link Material -> Product
        console.log("Linking Materials to Products...");
        const linkSession = driver.session();
        await linkSession.run(`
            MATCH (m:Material), (p:Product)
            WHERE m.id = p.id
            MERGE (m)-[:IS_PRODUCT]->(p)
        `);
        await linkSession.close();

        // Product Descriptions
        console.log("Ingesting Product Descriptions...");
        await ingestDirectory('product_descriptions', async (data, session) => {
            if (data.language === 'EN' || data.language === 'en') {
                await session.run(`
                    MERGE (p:Product {id: $id})
                    SET p.name = $name
                `, { id: data.product, name: data.productDescription || '' });
            }
        });

        // Plants
        console.log("Ingesting Plants...");
        await ingestDirectory('plants', async (data, session) => {
            await session.run(`
                MERGE (pl:Plant {id: $id})
                SET pl.name = $name, pl.plantCategory = $category
            `, {
                id: data.plant, name: data.plantName || '', category: data.plantCategory || ''
            });
        });

        // Product-Plant relationships
        console.log("Ingesting Product-Plant relationships...");
        await ingestDirectory('product_plants', async (data, session) => {
            await session.run(`
                MERGE (p:Product {id: $productId})
                MERGE (pl:Plant {id: $plantId})
                MERGE (p)-[:PRODUCED_AT]->(pl)
            `, { productId: data.product, plantId: data.plant });
        });

        // Addresses
        console.log("Ingesting Addresses...");
        await ingestDirectory('business_partner_addresses', async (data, session) => {
            await session.run(`
                MERGE (a:Address {id: $id})
                SET a.city = $city, a.country = $country, a.postalCode = $postalCode,
                    a.region = $region, a.street = $street
                WITH a
                MATCH (c:Customer {id: $bpId})
                MERGE (c)-[:HAS_ADDRESS]->(a)
            `, {
                id: data.addressId, city: data.cityName || '', country: data.country || '',
                postalCode: data.postalCode || '', region: data.region || '',
                street: data.streetName || '', bpId: data.businessPartner
            });
        });

        // Payments
        console.log("Ingesting Payments...");
        await ingestDirectory('payments_accounts_receivable', async (data, session) => {
            const paymentId = `${data.accountingDocument}-${data.accountingDocumentItem}`;
            await session.run(`
                MERGE (pay:Payment {id: $id})
                SET pay.amount = $amount, pay.currency = $currency, pay.postingDate = $postingDate,
                    pay.clearingDate = $clearingDate, pay.customer = $customer
                WITH pay
                MATCH (b:BillingDocument {id: $invoiceRef})
                MERGE (pay)-[:PAYS_FOR]->(b)
            `, {
                id: paymentId, amount: parseFloat(data.amountInTransactionCurrency) || 0,
                currency: data.transactionCurrency || '', postingDate: data.postingDate || '',
                clearingDate: data.clearingDate || '', customer: data.customer || '',
                invoiceRef: data.invoiceReference || ''
            });
        });

        console.log("Graph Details construction completed successfully!");
    } catch (e) {
        console.error("Ingestion failed:", e);
    } finally {
        await driver.close();
    }
}

main();
