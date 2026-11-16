import { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Field, SelectInput } from "@/components/workspace/form";
import { COMMISSION_BASES, commissionArithmetic, expectedCommissionYearly, MONEY } from "@/data/opportunityClose";

// The commission's three fields (D-466), shared by the win's dialog and by "Add commission" / "Change commission" on the banner: its basis, its number, and the yearly
// figure it works out to. The figure is worked out from the basis, the number, the quote's admin fee and the employees, and the person may overwrite it; what they
// typed over it is kept until they change the basis or the number, which asks for the working again (the arithmetic beside it is then the figure's).

/** The form the fields belong to holds `commission_basis`, `commission_rate` and `commission_yearly`, all text. */
export function CommissionFields({ form, adminFeePepm, employees, yearlyTyped = false }: {
  form: UseFormReturn<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  adminFeePepm: number | null;
  employees: number | null;
  /** The yearly figure already in the form was set by a person (a commission being changed), so it is kept until the basis or the number moves. */
  yearlyTyped?: boolean;
}) {
  const basis = form.watch("commission_basis") as string;
  const rate = form.watch("commission_rate") as string;
  const typed = useRef(yearlyTyped);
  const figures = (b: string, r: string) => ({ basis: b, rate: Number(r), adminFeePepm, employees });
  const yearlyFor = (b: string, r: string): string => {
    const worked = MONEY.test(r) ? expectedCommissionYearly(figures(b, r)) : null;
    return worked === null ? "" : String(worked);
  };
  // A figure nobody typed follows the quote chosen (its admin fee) and the employees.
  useEffect(() => {
    if (!typed.current) form.setValue("commission_yearly", yearlyFor(form.getValues("commission_basis"), form.getValues("commission_rate")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminFeePepm, employees]);
  const basisNow = COMMISSION_BASES.find((b) => b.value === basis);
  const arithmetic = MONEY.test(rate) ? commissionArithmetic(figures(basis, rate)) : null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field name="commission_basis" label="Commission basis">
        {(field) => (
          <SelectInput
            {...field}
            onChange={(e) => {
              typed.current = false;
              field.onChange(e);
              const next = e.target.value;
              if (next === "") form.setValue("commission_rate", "");
              form.setValue("commission_yearly", next === "" ? "" : yearlyFor(next, rate));
            }}
          >
            <option value="">None recorded</option>
            {COMMISSION_BASES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </SelectInput>
        )}
      </Field>
      {basisNow && (
        <Field name="commission_rate" label={basisNow.numberLabel}>
          {(field) => (
            <Input
              {...field}
              inputMode="decimal"
              onChange={(e) => {
                typed.current = false;
                field.onChange(e);
                form.setValue("commission_yearly", yearlyFor(basis, e.target.value));
              }}
            />
          )}
        </Field>
      )}
      {basisNow && (
        <Field name="commission_yearly" label="Expected commission, a year" help={arithmetic}>
          {(field) => <Input {...field} inputMode="decimal" onChange={(e) => { typed.current = true; field.onChange(e); }} />}
        </Field>
      )}
    </div>
  );
}
