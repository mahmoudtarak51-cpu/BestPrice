import './globals.css';

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="rootShell">{props.children}</div>
      </body>
    </html>
  );
}