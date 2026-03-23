export const LABEL_COLORS: Record<string, { dot: string; border: string }> = {
    Customer:        { dot: '#10b981', border: '#059669' },
    SalesOrder:      { dot: '#3b82f6', border: '#2563eb' },
    SalesOrderItem:  { dot: '#60a5fa', border: '#3b82f6' },
    DeliveryDocument:{ dot: '#8b5cf6', border: '#7c3aed' },
    DeliveryItem:    { dot: '#a78bfa', border: '#8b5cf6' },
    BillingDocument: { dot: '#ef4444', border: '#dc2626' },
    BillingItem:     { dot: '#f87171', border: '#ef4444' },
    JournalEntry:    { dot: '#06b6d4', border: '#0891b2' },
    Payment:         { dot: '#22c55e', border: '#16a34a' },
    Material:        { dot: '#f59e0b', border: '#d97706' },
    Product:         { dot: '#f97316', border: '#ea580c' },
    Plant:           { dot: '#84cc16', border: '#65a30d' },
    Address:         { dot: '#14b8a6', border: '#0d9488' },
};

export const CLUSTER_CENTERS: Record<string, { x: number; y: number }> = {
    Customer:        { x: -600, y: -300 },
    SalesOrder:      { x: -300, y: -300 },
    SalesOrderItem:  { x:  0,   y: -300 },
    Material:        { x:  300, y: -300 },
    Product:         { x:  600, y: -300 },
    Plant:           { x:  600, y:  0   },
    Address:         { x: -600, y:  0   },
    DeliveryDocument:{ x: -300, y:  300 },
    DeliveryItem:    { x:  0,   y:  300 },
    BillingDocument: { x:  300, y:  300 },
    BillingItem:     { x:  500, y:  300 },
    JournalEntry:    { x:  600, y:  500 },
    Payment:         { x:  300, y:  500 },
};

export const HUB_LABELS = new Set(['SalesOrder','DeliveryDocument','BillingDocument','JournalEntry','Customer','Product','Plant']);
