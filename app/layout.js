
import { Providers } from './providers'
import './styles/globals.css';

export const metadata = {
  title: "Data Talk - דשבורד אנליטיקס חכם",
  description: "דשבורד אנליטיקס חכם לעסקים קטנים",
  keywords: "אנליטיקס, Google Analytics, Search Console, עברית, דשבורד",
  authors: [{ name: "Data Talk" }],
  robots: "index, follow",
};

// Separate viewport export (Next.js 15 requirement)
export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
