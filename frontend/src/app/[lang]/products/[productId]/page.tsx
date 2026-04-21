import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { ProductPageContent } from '@/features/product/product-page';

export const dynamicParams = true;

interface ProductDetailPageProps {
  params: Promise<{
    lang: string;
    productId: string;
  }>;
  searchParams?: Promise<Record<string, string>>;
}

// Generate metadata for SEO
export async function generateMetadata(props: ProductDetailPageProps) {
  const params = await props.params;
  const { productId, lang } = params;

  try {
    const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';
    const product = await fetch(`${API_BASE_URL}/products/${productId}?lang=${lang}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    }).then((res) => res.json());

    if (!product) {
      return {
        title: 'Product Not Found',
      };
    }

    return {
      title: `${product.title} - BestPrice Egypt`,
      description: product.description || `Compare prices for ${product.title} across retailers`,
      openGraph: {
        title: product.title,
        description: product.description,
        images: product.images?.[0] ? [{ url: product.images[0] }] : [],
      },
    };
  } catch {
    return {
      title: 'Product',
    };
  }
}

export default async function ProductDetailPage(props: ProductDetailPageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { lang, productId } = params;

  // Validate language
  if (!['ar', 'en'].includes(lang)) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense
        fallback={
          <div className="container mx-auto px-4 py-8">
            <div className="space-y-4">
              <div className="h-8 bg-gray-200 rounded animate-pulse w-3/4" />
              <div className="h-4 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        }
      >
        <ProductPageContent 
          productId={productId} 
          lang={lang as 'ar' | 'en'}
          searchParams={searchParams || {}}
        />
      </Suspense>
    </div>
  );
}
