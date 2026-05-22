import { getVerifiedAdminApiClient } from "@/lib/api-auth";
import { noStoreJson } from "@/lib/http";

const exportTables = [
  "clients",
  "albums",
  "album_clients",
  "photos",
  "download_logs",
  "upload_events",
  "contact_inquiries",
  "shoot_requests",
  "admin_audit_logs"
] as const;

type ExportTable = (typeof exportTables)[number];

function isExportTable(value: string | null): value is ExportTable {
  return Boolean(value && exportTables.includes(value as ExportTable));
}

function filenameStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);

  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) {
    return "";
  }

  const columns = Object.keys(rows[0]);
  const header = columns.map(csvCell).join(",");
  const body = rows.map((row) => columns.map((column) => csvCell(row[column])).join(","));

  return [header, ...body].join("\n");
}

async function fetchTable(
  supabase: Awaited<ReturnType<typeof getVerifiedAdminApiClient>>,
  table: ExportTable
) {
  if (!supabase) {
    return { rows: [], error: "Unauthorized." };
  }

  const { data, error } = await supabase.from(table).select("*");

  return {
    rows: (data ?? []) as Array<Record<string, unknown>>,
    error: error?.message ?? null
  };
}

export async function GET(request: Request) {
  const supabase = await getVerifiedAdminApiClient();

  if (!supabase) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const tableParam = url.searchParams.get("table");
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";

  if (format === "csv") {
    if (!isExportTable(tableParam)) {
      return noStoreJson(
        { error: "Choose one table when exporting CSV." },
        { status: 400 }
      );
    }

    const result = await fetchTable(supabase, tableParam);

    if (result.error) {
      return noStoreJson({ error: result.error }, { status: 400 });
    }

    return new Response(toCsv(result.rows), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${tableParam}-${filenameStamp()}.csv"`,
        "Content-Type": "text/csv; charset=utf-8"
      }
    });
  }

  const tables = tableParam && isExportTable(tableParam) ? [tableParam] : exportTables;
  const exportedTables = Object.fromEntries(
    await Promise.all(
      tables.map(async (table) => {
        const result = await fetchTable(supabase, table);
        return [table, result];
      })
    )
  );

  return new Response(
    JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        tables: exportedTables
      },
      null,
      2
    ),
    {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="rxncor-studio-export-${filenameStamp()}.json"`,
        "Content-Type": "application/json; charset=utf-8"
      }
    }
  );
}
