export type SummaryTransaction = { type: "expense" | "income" | "refund" | "transfer"; amountPaise: number; source?: string; transferGroupId?: string };

export function summarizeTransactions(items: SummaryTransaction[]) {
  return items.reduce((summary, item) => {
    if (item.type === "transfer" || item.source === "card_payment") return summary;
    if (item.type === "income") summary.incomePaise += item.amountPaise;
    if (item.type === "expense") summary.expensePaise += item.amountPaise;
    if (item.type === "refund") summary.refundPaise += item.amountPaise;
    summary.savingsPaise = summary.incomePaise - summary.expensePaise + summary.refundPaise;
    return summary;
  }, { incomePaise: 0, expensePaise: 0, refundPaise: 0, savingsPaise: 0 });
}

export function budgetStatus(spentPaise: number, limitPaise: number, thresholds = [75, 90, 100]) {
  if (!Number.isInteger(spentPaise) || !Number.isInteger(limitPaise) || spentPaise < 0 || limitPaise <= 0) throw new Error("Invalid budget amounts");
  const percent = Math.round((spentPaise / limitPaise) * 10_000) / 100;
  return { spentPaise, limitPaise, remainingPaise: Math.max(0, limitPaise - spentPaise), percent, crossed: thresholds.filter((value) => percent >= value) };
}

export function projectedMonthEnd(spentPaise: number, elapsedDays: number, daysInMonth: number) {
  if (spentPaise < 0 || elapsedDays < 1 || daysInMonth < elapsedDays) throw new Error("Invalid projection inputs");
  return Math.round((spentPaise / elapsedDays) * daysInMonth);
}

