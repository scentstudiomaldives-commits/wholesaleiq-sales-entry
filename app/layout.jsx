export const metadata = {
  title: "STO General Trading — Wholesale Dashboard",
  description: "Daily sales and customer data entry",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, background: "#F4F7FB", fontFamily: "Inter, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
