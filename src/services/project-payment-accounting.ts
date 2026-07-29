import { Invoice } from "@/models/Invoice";

export function paymentAccountingStages() {
  return [
    { $lookup: { from: Invoice.collection.name, localField: "invoiceId", foreignField: "_id", as: "invoiceForAccounting" } },
    { $addFields: { invoiceForAccounting: { $first: "$invoiceForAccounting" } } },
    {
      $addFields: {
        serviceAmountForAccounting: {
          $cond: [
            {
              $and: [
                { $eq: ["$invoiceForAccounting.vatApplicable", true] },
                { $gt: [{ $ifNull: ["$invoiceForAccounting.total", 0] }, 0] },
                { $gt: [{ $ifNull: ["$invoiceForAccounting.vatAmount", 0] }, 0] }
              ]
            },
            { $multiply: ["$amount", { $divide: [{ $ifNull: ["$invoiceForAccounting.subtotal", "$amount"] }, "$invoiceForAccounting.total"] }] },
            "$amount"
          ]
        },
        vatPortionForAccounting: {
          $cond: [
            {
              $and: [
                { $eq: ["$invoiceForAccounting.vatApplicable", true] },
                { $gt: [{ $ifNull: ["$invoiceForAccounting.total", 0] }, 0] },
                { $gt: [{ $ifNull: ["$invoiceForAccounting.vatAmount", 0] }, 0] }
              ]
            },
            { $multiply: ["$amount", { $divide: ["$invoiceForAccounting.vatAmount", "$invoiceForAccounting.total"] }] },
            0
          ]
        }
      }
    }
  ];
}

export function paymentBreakdown(payment: any) {
  const amount = round(payment?.amount ?? 0);
  const invoice = payment?.invoiceId && typeof payment.invoiceId === "object" ? payment.invoiceId : payment?.invoiceForAccounting;
  if (!invoice?.vatApplicable || !invoice?.total || !invoice?.vatAmount) {
    return { cashAmount: amount, serviceAmount: amount, vatPortion: 0 };
  }
  const vatPortion = round(amount * ((invoice.vatAmount ?? 0) / invoice.total));
  return {
    cashAmount: amount,
    serviceAmount: round(amount - vatPortion),
    vatPortion
  };
}

function round(value: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : 0;
}
