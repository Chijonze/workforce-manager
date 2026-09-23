import { Check, X } from "lucide-react";
import { comparisonRows } from "@/lib/site-content";

export function ComparisonTable() {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <caption className="sr-only">
            Hiring in-house versus using Advanced Virtual Solutions
          </caption>
          <thead>
            <tr className="bg-navy text-white">
              <th scope="col" className="px-6 py-5 font-heading text-sm font-bold uppercase tracking-wide">
                What to consider
              </th>
              <th scope="col" className="px-6 py-5 font-heading text-sm font-bold uppercase tracking-wide">
                In-house hire
              </th>
              <th scope="col" className="px-6 py-5 font-heading text-sm font-bold uppercase tracking-wide text-brand-green">
                Advanced Virtual Solutions
              </th>
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row, index) => (
              <tr
                className={index % 2 === 0 ? "bg-white" : "bg-cloud"}
                key={row.label}
              >
                <th scope="row" className="px-6 py-5 align-top font-heading text-sm font-bold text-navy">
                  {row.label}
                </th>
                <td className="px-6 py-5 align-top text-sm leading-6 text-slate-500">
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 align-middle">
                    <X className="text-rose-600" size={12} />
                  </span>
                  {row.inHouse}
                </td>
                <td className="px-6 py-5 align-top text-sm font-medium leading-6 text-navy">
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 align-middle">
                    <Check className="text-brand-green-dark" size={12} />
                  </span>
                  {row.avs}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
