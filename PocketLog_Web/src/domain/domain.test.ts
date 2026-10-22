import { describe, expect, it } from "vitest";
import { budgetStatus, projectedMonthEnd, summarizeTransactions } from "./finance";
import { calculateMileage } from "./vehicle";
import { currentStreak } from "./habits";
import { parseFinancialMessage } from "./import-parser";

describe("finance", () => {
  it("excludes transfers and card repayments", () => expect(summarizeTransactions([
    { type: "income", amountPaise: 10000 }, { type: "expense", amountPaise: 2500 }, { type: "transfer", amountPaise: 9000 }, { type: "expense", amountPaise: 2500, source: "card_payment" },
  ])).toEqual({ incomePaise: 10000, expensePaise: 2500, refundPaise: 0, savingsPaise: 7500 }));
  it("reports crossed thresholds and projections", () => {
    expect(budgetStatus(9000, 10000).crossed).toEqual([75, 90]);
    expect(projectedMonthEnd(10000, 10, 30)).toBe(30000);
  });
});

describe("mileage", () => {
  it("uses all fuel between full tanks", () => expect(calculateMileage([
    { odometerKm: 1000, litres: 4, fullTank: true }, { odometerKm: 1080, litres: 2, fullTank: false }, { odometerKm: 1160, litres: 3, fullTank: true },
  ])).toEqual({ distanceKm: 160, litres: 5, kmPerLitre: 32, estimated: true }));
  it("does not claim mileage from one partial fill", () => expect(calculateMileage([{ odometerKm: 100, litres: 2, fullTank: false }])).toBeNull());
});

it("habit rest days do not break a streak", () => expect(currentStreak([{ localDate: "2026-10-21", state: "completed" }, { localDate: "2026-10-20", state: "rest" }, { localDate: "2026-10-19", state: "completed" }], "2026-10-21")).toBe(2));

describe("import parser", () => {
  it("extracts a synthetic debit", () => {
    const parsed = parseFinancialMessage("INR 1,234.50 debited from card at SAMPLE STORE on 21-Oct", new Date("2026-10-21T10:00:00Z"), "synthetic.bank");
    expect(parsed).toMatchObject({ amountPaise: 123450, type: "expense", merchant: "SAMPLE STORE", confidence: 1 });
  });
  it("marks hidden amounts unsupported", () => expect(parseFinancialMessage("You have a new transaction", new Date(), "synthetic.bank").unsupportedReason).toBeTruthy());
});

