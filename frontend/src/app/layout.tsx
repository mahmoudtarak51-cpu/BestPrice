import type { ReactNode } from 'react';
import './globals.css';

export default function RootLayout(props: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="rootShell">{props.children}</div>
      </body>
    </html>
  );
}