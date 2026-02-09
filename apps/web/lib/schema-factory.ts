/**
 * Schema Factory — Generates JSON-LD structured data for SEO
 *
 * Creates valid schema.org markup for Article, Organization, and other types.
 */

export interface SchemaArticleInput {
  title: string;
  description?: string;
  url: string;
  author?: string;
  datePublished?: string;
  dateModified?: string;
  imageUrl?: string;
  keywords?: string;
  wordCount?: number;
}

export interface SchemaOrganizationInput {
  name: string;
  url: string;
  logoUrl?: string;
  description?: string;
  sameAs?: string[]; // Social media profiles
}

export interface SchemaWebPageInput {
  name: string;
  description?: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
}

export interface FaqCandidate {
  q: string; // Question
  a: string; // Answer
}

/**
 * Generate Article JSON-LD schema
 *
 * @param input - Article data
 * @returns JSON-LD Article schema object
 */
export function generateArticleSchema(input: SchemaArticleInput): object {
  const schema: any = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    url: input.url,
  };

  // Add optional fields if provided
  if (input.description) {
    schema.description = input.description;
  }

  if (input.author) {
    schema.author = {
      "@type": "Person",
      name: input.author,
    };
  }

  if (input.datePublished) {
    schema.datePublished = input.datePublished;
  }

  if (input.dateModified) {
    schema.dateModified = input.dateModified;
  }

  if (input.imageUrl) {
    schema.image = {
      "@type": "ImageObject",
      url: input.imageUrl,
    };
  }

  if (input.keywords) {
    schema.keywords = input.keywords;
  }

  if (input.wordCount) {
    schema.wordCount = input.wordCount;
  }

  // Add publisher (placeholder - should be configured per site)
  schema.publisher = {
    "@type": "Organization",
    name: "Publisher Name", // TODO: Make this configurable
  };

  return schema;
}

/**
 * Generate Organization JSON-LD schema
 *
 * @param input - Organization data
 * @returns JSON-LD Organization schema object
 */
export function generateOrganizationSchema(input: SchemaOrganizationInput): object {
  const schema: any = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.name,
    url: input.url,
  };

  if (input.logoUrl) {
    schema.logo = {
      "@type": "ImageObject",
      url: input.logoUrl,
    };
  }

  if (input.description) {
    schema.description = input.description;
  }

  if (input.sameAs && input.sameAs.length > 0) {
    schema.sameAs = input.sameAs;
  }

  return schema;
}

/**
 * Generate WebPage JSON-LD schema (for non-article pages)
 *
 * @param input - WebPage data
 * @returns JSON-LD WebPage schema object
 */
export function generateWebPageSchema(input: SchemaWebPageInput): object {
  const schema: any = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: input.name,
    url: input.url,
  };

  if (input.description) {
    schema.description = input.description;
  }

  if (input.datePublished) {
    schema.datePublished = input.datePublished;
  }

  if (input.dateModified) {
    schema.dateModified = input.dateModified;
  }

  return schema;
}

/**
 * Generate appropriate schema based on page type
 *
 * @param pageType - Type of page ("post" or "page")
 * @param data - Page data
 * @returns JSON-LD schema object
 */
export function generateSchemaForPageType(
  pageType: "post" | "page",
  data: {
    title: string;
    description?: string;
    url: string;
    author?: string;
    datePublished?: string;
    dateModified?: string;
    keywords?: string;
  }
): object {
  if (pageType === "post") {
    // Blog posts get Article schema
    return generateArticleSchema({
      title: data.title,
      description: data.description,
      url: data.url,
      author: data.author || "Site Author",
      datePublished: data.datePublished,
      dateModified: data.dateModified,
      keywords: data.keywords,
    });
  } else {
    // Static pages get WebPage schema
    return generateWebPageSchema({
      name: data.title,
      description: data.description,
      url: data.url,
      datePublished: data.datePublished,
      dateModified: data.dateModified,
    });
  }
}

/**
 * Build FAQPage JSON-LD schema from FAQ candidates
 *
 * Creates a valid Schema.org FAQPage structure with Question/Answer entities.
 *
 * @param candidates - Array of FAQ question/answer pairs
 * @returns FAQPage schema object
 */
export function buildAeoFaqSchema(candidates: FaqCandidate[]): object {
  if (!candidates || candidates.length === 0) {
    throw new Error("FAQ candidates array cannot be empty");
  }

  const mainEntity = candidates.map((candidate) => ({
    "@type": "Question",
    name: candidate.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: candidate.a,
    },
  }));

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity,
  };
}

/**
 * Combine multiple schemas using JSON-LD @graph structure
 *
 * When a page has both Article and FAQPage schemas (or any combination),
 * this function wraps them in a @graph array following JSON-LD standards.
 *
 * @param schemas - Array of schema objects to combine
 * @returns Combined schema with @graph structure
 */
export function combineSchemas(schemas: object[]): object {
  if (!schemas || schemas.length === 0) {
    throw new Error("Schemas array cannot be empty");
  }

  // If only one schema, return it as-is
  if (schemas.length === 1) {
    return schemas[0];
  }

  // Remove @context from individual schemas and combine in @graph
  const graphItems = schemas.map((schema: any) => {
    const { "@context": _context, ...rest } = schema;
    return rest;
  });

  return {
    "@context": "https://schema.org",
    "@graph": graphItems,
  };
}

/**
 * Build combined Article + FAQPage schema
 *
 * Convenience function that combines an Article schema with FAQ content
 * using the proper @graph structure.
 *
 * @param articleInput - Article schema input data
 * @param faqCandidates - FAQ question/answer pairs
 * @returns Combined schema with both Article and FAQPage
 */
export function buildArticleWithFaqSchema(
  articleInput: SchemaArticleInput,
  faqCandidates: FaqCandidate[]
): object {
  const articleSchema = generateArticleSchema(articleInput);
  const faqSchema = buildAeoFaqSchema(faqCandidates);

  return combineSchemas([articleSchema, faqSchema]);
}

/**
 * Validate schema object structure
 *
 * @param schema - Schema object to validate
 * @returns True if valid, false otherwise
 */
export function validateSchema(schema: any): boolean {
  if (!schema || typeof schema !== "object") {
    return false;
  }

  // Must have @context and @type (or @graph for combined schemas)
  if (!schema["@context"]) {
    return false;
  }

  // Either has @type or @graph
  if (!schema["@type"] && !schema["@graph"]) {
    return false;
  }

  // @context should be schema.org
  if (!schema["@context"].includes("schema.org")) {
    return false;
  }

  return true;
}

/**
 * Convert schema object to JSON string
 *
 * @param schema - Schema object
 * @returns JSON string
 */
export function schemaToJson(schema: object): string {
  return JSON.stringify(schema, null, 2);
}
