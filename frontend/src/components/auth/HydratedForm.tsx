'use client';

import { useEffect, useState, type FormHTMLAttributes } from 'react';

/** Prevent native form submission before React installs the submit handler. */
export default function HydratedForm({ children, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <form {...props}>
      <fieldset disabled={!ready} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
