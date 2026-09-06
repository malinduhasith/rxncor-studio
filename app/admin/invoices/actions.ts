"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { optionalEnv } from "@/config/server-env";
import { siteConfig } from "@/config/site";
import { isAdminEmailAllowed } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/audit-log";
import { sendInvoiceEmail } from "@/lib/email";
import { invoiceTotals, type InvoiceItemInput } from "@/lib/invoices";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function admin() {
  const auth = await createSupabaseServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect(siteConfig.routes.adminLogin);
  if (!isAdminEmailAllowed(user.email)) redirect(`${siteConfig.routes.adminLogin}?error=unauthorized`);
  return createSupabaseAdminClient();
}
const itemSchema = z.object({ description:z.string().trim().min(1), category:z.string(), work_context:z.string(), quantity:z.coerce.number().positive(), unit:z.string(), unit_price_cents:z.coerce.number().int().nonnegative() });
const invoiceSchema = z.object({ client_id:z.string().uuid().nullable().optional(), client_name:z.string().trim().min(1), client_email:z.string().trim().email(), client_phone:z.string().optional(), client_address:z.string().optional(), project_title:z.string().optional(), issue_date:z.string(), due_date:z.string(), gst_rate:z.coerce.number().min(0).max(100), notes:z.string().optional(), terms:z.string().optional(), items:z.array(itemSchema).min(1) });

export async function createInvoiceAction(formData: FormData) {
  const supabase = await admin();
  const parsed = invoiceSchema.safeParse(JSON.parse(String(formData.get("payload") || "{}")));
  if (!parsed.success) redirect("/admin/invoices?notice=invalid");
  const input=parsed.data; const totals=invoiceTotals(input.items as InvoiceItemInput[],input.gst_rate);
  const [{data:numberData,error:numberError},{data:settings}] = await Promise.all([supabase.rpc("allocate_invoice_number"),supabase.from("invoice_settings").select("*").eq("id","main").maybeSingle()]);
  if(numberError || !numberData) redirect("/admin/invoices?notice=setup");
  const payId=settings?.pay_id || optionalEnv("INVOICE_PAYID") || null;
  const {data:invoice,error}=await supabase.from("invoices").insert({...input,items:undefined,invoice_number:numberData,subtotal_cents:totals.subtotal,gst_cents:totals.gst,total_cents:totals.total,issuer_snapshot:{business_name:settings?.business_name||"RXNCOR Studio",issuer_name:settings?.issuer_name||"Malindu Herath",email:settings?.email,phone:settings?.phone,address:settings?.address,abn:settings?.abn},payment_snapshot:{pay_id:payId,bank_name:settings?.bank_name,account_name:settings?.account_name,bsb:settings?.bsb,account_number:settings?.account_number}}).select("id").single();
  if(error||!invoice) redirect("/admin/invoices?notice=error");
  const {error:itemError}=await supabase.from("invoice_items").insert(input.items.map((item,index)=>({...item,invoice_id:invoice.id,line_total_cents:Math.round(item.quantity*item.unit_price_cents),sort_order:index})));
  if(itemError){await supabase.from("invoices").delete().eq("id",invoice.id);redirect("/admin/invoices?notice=error");}
  await logAdminAudit(supabase,{action:"invoice.create",entityType:"invoice",entityId:invoice.id,summary:`Created ${numberData}`});
  revalidatePath("/admin/invoices"); redirect(`/admin/invoices?invoice=${invoice.id}&notice=created`);
}

export async function invoiceStatusAction(formData: FormData) {
  const supabase=await admin(); const id=String(formData.get("invoice_id")); const action=String(formData.get("invoice_action"));
  if(!z.string().uuid().safeParse(id).success) redirect("/admin/invoices?notice=invalid");
  const {data:invoice}=await supabase.from("invoices").select("*").eq("id",id).single(); if(!invoice) redirect("/admin/invoices?notice=missing");
  if(action==="delete" && ["draft","void"].includes(invoice.status)){await supabase.from("invoices").delete().eq("id",id);redirect("/admin/invoices?notice=deleted");}
  if(action==="paid") await supabase.from("invoices").update({status:"paid",paid_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);
  if(action==="void") await supabase.from("invoices").update({status:"void",updated_at:new Date().toISOString()}).eq("id",id);
  if(action==="reopen") await supabase.from("invoices").update({status:"draft",sent_at:null,paid_at:null,updated_at:new Date().toISOString()}).eq("id",id);
  if(action==="send") {
    const base=process.env.NEXT_PUBLIC_SITE_URL||"https://rxncor.studio";
    const result=await sendInvoiceEmail({invoiceId:id,invoiceNumber:invoice.invoice_number,clientName:invoice.client_name,clientEmail:invoice.client_email,projectTitle:invoice.project_title,issueDate:invoice.issue_date,dueDate:invoice.due_date,total:new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD"}).format(invoice.total_cents/100),invoiceUrl:`${base}/invoice/${invoice.public_token}`,payId:invoice.payment_snapshot?.pay_id,bankName:invoice.payment_snapshot?.bank_name,accountName:invoice.payment_snapshot?.account_name,bsb:invoice.payment_snapshot?.bsb,accountNumber:invoice.payment_snapshot?.account_number});
    if(result.sent>0) await supabase.from("invoices").update({status:invoice.status==="paid"?"paid":"sent",sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);
    else redirect(`/admin/invoices?invoice=${id}&notice=email-error`);
  }
  await logAdminAudit(supabase,{action:`invoice.${action}`,entityType:"invoice",entityId:id,summary:`${action} ${invoice.invoice_number}`});
  revalidatePath("/admin/invoices"); revalidatePath(`/invoice/${invoice.public_token}`); redirect(`/admin/invoices?invoice=${id}&notice=${action}`);
}

const rateSchema = z.object({
  id: z.union([z.string().uuid(), z.literal("")]),
  client_id: z.union([z.string().uuid(), z.literal("")]),
  service_name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(60),
  work_context: z.string().trim().min(1).max(60),
  unit: z.string().trim().min(1).max(40),
  rate: z.coerce.number().finite().min(0).max(1_000_000),
});

export async function saveRateAction(formData: FormData) {
  const supabase = await admin();
  const parsed = rateSchema.safeParse({
    id: String(formData.get("id") || ""),
    client_id: String(formData.get("client_id") || ""),
    service_name: String(formData.get("service_name") || ""),
    category: String(formData.get("category") || "Other"),
    work_context: String(formData.get("work_context") || "Any"),
    unit: String(formData.get("unit") || "hour"),
    rate: formData.get("rate"),
  });

  if (!parsed.success) redirect("/admin/invoices?tab=rates&notice=invalid");
  const { id, client_id, rate, ...details } = parsed.data;
  const row = {
    ...details,
    client_id: client_id || null,
    rate_cents: Math.round(rate * 100),
    is_active: true,
  };
  const result = id
    ? await supabase.from("client_rates").update(row).eq("id", id)
    : await supabase.from("client_rates").insert(row);

  if (result.error) redirect("/admin/invoices?tab=rates&notice=error");
  await logAdminAudit(supabase, {
    action: id ? "invoice_rate.update" : "invoice_rate.create",
    entityType: "client_rate",
    entityId: id || undefined,
    summary: `${id ? "Updated" : "Created"} ${details.service_name}`,
  });
  revalidatePath("/admin/invoices");
  redirect("/admin/invoices?tab=rates&notice=rate-saved");
}

export async function deleteRateAction(formData: FormData) {
  const supabase = await admin();
  const id = String(formData.get("id") || "");
  if (!z.string().uuid().safeParse(id).success) {
    redirect("/admin/invoices?tab=rates&notice=invalid");
  }

  const { data: rate } = await supabase
    .from("client_rates")
    .select("service_name")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("client_rates").delete().eq("id", id);
  if (error) redirect("/admin/invoices?tab=rates&notice=error");
  await logAdminAudit(supabase, {
    action: "invoice_rate.delete",
    entityType: "client_rate",
    entityId: id,
    summary: `Deleted ${rate?.service_name || "invoice rate"}`,
  });
  revalidatePath("/admin/invoices");
  redirect("/admin/invoices?tab=rates&notice=rate-deleted");
}
export async function saveSettingsAction(formData:FormData){const supabase=await admin();await supabase.from("invoice_settings").upsert({id:"main",business_name:String(formData.get("business_name")),issuer_name:String(formData.get("issuer_name")),email:String(formData.get("email")||"")||null,phone:String(formData.get("phone")||"")||null,address:String(formData.get("address")||"")||null,abn:String(formData.get("abn")||"")||null,pay_id:String(formData.get("pay_id")||"")||null,bank_name:String(formData.get("bank_name")||"")||null,account_name:String(formData.get("account_name")||"")||null,bsb:String(formData.get("bsb")||"")||null,account_number:String(formData.get("account_number")||"")||null,invoice_prefix:String(formData.get("invoice_prefix")||"RX"),default_due_days:Number(formData.get("default_due_days")||14),default_gst_rate:Number(formData.get("default_gst_rate")||0),default_notes:String(formData.get("default_notes")||"")||null,updated_at:new Date().toISOString()});revalidatePath("/admin/invoices");redirect("/admin/invoices?tab=settings&notice=settings-saved");}
