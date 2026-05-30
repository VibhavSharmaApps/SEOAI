import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, ExternalLink, Search } from "lucide-react";
import { getSite } from "@/app/actions/sites";
import { listSitePages } from "@/app/actions/pages";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshPagesButton } from "@/components/dashboard/refresh-pages-button";
import type {
  WpPagesOrder,
  WpPagesOrderBy,
  WpPagesStatus,
} from "@/lib/wp-api";

interface PageProps {
  params: { siteId: string };
  // `welcome` is set by the connect-site wizard's post-verify redirect so
  // we can render an onboarding banner on first arrival. Drops on any
  // subsequent navigation (pagination, refresh) — no need to dismiss.
  searchParams: {
    offset?: string;
    limit?: string;
    welcome?: string;
    orderby?: string;
    order?: string;
    status?: string;
    q?: string;
  };
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const ORDERBY_VALUES: WpPagesOrderBy[] = ["modified", "date", "title"];
const ORDER_VALUES: WpPagesOrder[] = ["DESC", "ASC"];
const STATUS_VALUES: WpPagesStatus[] = ["any", "publish", "draft"];

/**
 * Parse a numeric query-param into an integer, clamping to [min, max].
 * Returns `fallback` if the input is missing or unparseable. Used to
 * sanitize ?offset / ?limit from the URL so a bad URL never crashes the
 * page server-side.
 */
function clampInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Validate a query-param against a whitelist of allowed values. Returns
 * `fallback` if the value isn't in the list. Keeps the URL safe to feed
 * directly into fetchPagesList — the plugin also whitelists server-side
 * but a clean dashboard-side check avoids round-tripping bad values.
 */
function pickEnum<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  if (!raw) return fallback;
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

/**
 * Build a relative URL for a navigation link that preserves the current
 * filter state. Used for pagination buttons — clicking "Next" should keep
 * the sort/filter/search settings the user picked.
 */
function buildPagesUrl(
  siteId: string,
  state: {
    offset: number;
    limit: number;
    orderby: WpPagesOrderBy;
    order: WpPagesOrder;
    status: WpPagesStatus;
    search: string;
  }
): string {
  const params = new URLSearchParams();
  params.set("offset", String(state.offset));
  params.set("limit", String(state.limit));
  params.set("orderby", state.orderby);
  params.set("order", state.order);
  params.set("status", state.status);
  if (state.search) params.set("q", state.search);
  return `/dashboard/sites/${siteId}/pages?${params.toString()}`;
}

/**
 * Format a timestamp as a human-readable local string. Accepts both:
 *   - WP MySQL GMT format: "2024-01-15 14:30:00" (from live WP fetch)
 *   - ISO 8601:            "2024-01-15T14:30:00.000Z" (from Supabase cache)
 *
 * With the B1 cache layer the cache reads return ISO; without it (or for
 * the live path) we'd get MySQL format. Both are normalised here so the
 * UI doesn't need to know which path produced the row.
 */
function formatModified(raw: string): string {
  if (!raw) return "—";
  // ISO format already contains a "T" separator; MySQL GMT doesn't.
  const iso = raw.includes("T") ? raw : raw.replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString();
}

export default async function SitePagesPage({ params, searchParams }: PageProps) {
  const { siteId } = params;

  // Existence + ownership check. getSite respects Supabase RLS, so a null
  // result here means either the id is malformed or it belongs to another
  // user. We render the same 404 in both cases so we don't leak which.
  const site = await getSite(siteId);
  if (!site) notFound();

  const limit = clampInt(searchParams.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = clampInt(
    searchParams.offset,
    0,
    0,
    Number.MAX_SAFE_INTEGER
  );
  const orderby = pickEnum(searchParams.orderby, ORDERBY_VALUES, "modified");
  const order = pickEnum(searchParams.order, ORDER_VALUES, "DESC");
  const status = pickEnum(searchParams.status, STATUS_VALUES, "any");
  const search = (searchParams.q ?? "").trim().slice(0, 200);

  const result = await listSitePages(siteId, {
    limit,
    offset,
    orderby,
    order,
    status,
    search,
  });

  // Shared header so the page is still useful (back link + site name)
  // even when the fetch fails — e.g. user navigated here before
  // verifying the site.
  const header = (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pages</h1>
        <p className="text-sm text-muted-foreground">{site.name ?? site.domain}</p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href="/dashboard">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to sites
        </Link>
      </Button>
    </header>
  );

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-5xl">
        {header}
        <div className="border border-red-500/40 bg-red-50 dark:bg-red-950/20 rounded p-4 text-sm">
          <strong>Couldn&apos;t load pages.</strong> {result.error}
        </div>
      </div>
    );
  }

  const { pages, total } = result;
  const hasPrev = offset > 0;
  const hasNext = offset + pages.length < total;
  const showingFrom = pages.length === 0 ? 0 : offset + 1;
  const showingTo = offset + pages.length;

  return (
    <div className="mx-auto max-w-5xl">
      {header}

      {searchParams.welcome ? (
        <div className="mb-4 rounded-md border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20 p-3 text-sm">
          <strong>Connected!</strong> Pick a post below and click{" "}
          <em>Analyse</em> to run your first SEO scan.
        </div>
      ) : null}

      {/* Filter / sort / search form. Native HTML form with method=GET so
          submitting reloads the page with the new query params — no
          client-side state needed. Omitting `offset` from the form fields
          means the URL drops it on submit and we reset to page 1, which
          is the right behaviour for a freshly-applied filter. */}
      <form method="GET" className="mb-4 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="orderby" className="text-xs text-muted-foreground">
            Sort by
          </label>
          <select
            id="orderby"
            name="orderby"
            defaultValue={orderby}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="modified">Modified</option>
            <option value="date">Published</option>
            <option value="title">Title</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="order" className="text-xs text-muted-foreground">
            Direction
          </label>
          <select
            id="order"
            name="order"
            defaultValue={order}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="DESC">Newest first</option>
            <option value="ASC">Oldest first</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-xs text-muted-foreground">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="any">All</option>
            <option value="publish">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1 min-w-[12rem]">
          <label htmlFor="q" className="text-xs text-muted-foreground">
            Search title
          </label>
          <Input id="q" name="q" defaultValue={search} placeholder="cold brew..." />
        </div>
        <input type="hidden" name="limit" value={limit} />
        <Button type="submit" variant="outline">
          Apply filters
        </Button>
      </form>

      <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
        <p>
          {total === 0
            ? "No pages found."
            : `Showing ${showingFrom}–${showingTo} of ${total}`}
        </p>
        <RefreshPagesButton siteId={siteId} />
      </div>

      {pages.length === 0 ? (
        <div className="bg-card border rounded-lg p-8 text-center text-sm text-muted-foreground">
          No pages on this site yet. Publish a post or page in WordPress to see it here.
        </div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="w-20">Type</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-40">Last modified</TableHead>
                <TableHead className="w-28 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((page) => (
                <TableRow key={page.wp_post_id}>
                  <TableCell className="font-medium max-w-md">
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-foreground/80"
                    >
                      <span className="truncate">{page.title || "(untitled)"}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                    </a>
                  </TableCell>
                  <TableCell>
                    <Badge variant="muted">{page.post_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={page.status === "publish" ? "default" : "muted"}>
                      {page.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatModified(page.last_modified)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link
                        href={`/dashboard/seo-gaps?siteId=${siteId}&postId=${page.wp_post_id}`}
                      >
                        <Search className="mr-1 h-3 w-3" />
                        Analyse
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination — only show when there's actually more than one page.
          Links preserve sort/filter/search state via buildPagesUrl so the
          user doesn't lose their context when clicking through. */}
      {(hasPrev || hasNext) && (
        <div className="flex items-center justify-between mt-4">
          {hasPrev ? (
            <Button asChild variant="outline" size="sm">
              <Link
                href={buildPagesUrl(siteId, {
                  offset: Math.max(0, offset - limit),
                  limit,
                  orderby,
                  order,
                  status,
                  search,
                })}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {hasNext ? (
            <Button asChild variant="outline" size="sm">
              <Link
                href={buildPagesUrl(siteId, {
                  offset: offset + limit,
                  limit,
                  orderby,
                  order,
                  status,
                  search,
                })}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
