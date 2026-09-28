/**
 * @farm/customer — customer portal page.
 *
 * A self-service portal. A customer "signs in" by entering the email on
 * file; we look them up via `/customers?search=` and show their profile and
 * the events they're RSVP'd to. The signed-in customer id is remembered in
 * `localStorage`.
 *
 * This is intentionally lightweight — no passwords — matching the
 * read-mostly, customer-facing nature of the public site.
 */

import { useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, Spinner, Tag } from "@farm/ui";
import { customersApi, eventsApi, ApiError } from "../api.js";
import { formatDate } from "../hooks.js";
import type { Customer, FarmEvent } from "@farm/types";

const STORAGE_KEY = "farm.customer.portal.customerId";

function loadStoredId(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveStoredId(id: string): void {
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore storage failures */
  }
}

export function CustomerPortalPage(): JSX.Element {
  const [customerId, setCustomerId] = useState<string>(() => loadStoredId());
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | undefined>(undefined);

  // The resolved customer profile (loaded whenever we have a customerId).
  const [profile, setProfile] = useState<Customer | undefined>(undefined);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | undefined>(
    undefined,
  );

  // All events, used to derive the ones this customer is RSVP'd to.
  const [events, setEvents] = useState<FarmEvent[] | undefined>(undefined);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Load profile + events whenever the signed-in customer id changes.
  useEffect(() => {
    saveStoredId(customerId);
    if (!customerId) {
      setProfile(undefined);
      setEvents(undefined);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    setProfileError(undefined);
    setEventsLoading(true);
    customersApi
      .get(customerId)
      .then((c) => {
        if (!cancelled) setProfile(c);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setProfile(undefined);
          setProfileError(
            err instanceof ApiError && err.status === 404
              ? "No customer found for that id."
              : err instanceof Error
                ? err.message
                : "Couldn't load your profile.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    eventsApi
      .list()
      .then((all) => {
        if (!cancelled) setEvents(all);
      })
      .catch(() => {
        if (!cancelled) setEvents(undefined);
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const myEvents = useMemo(() => {
    if (!events || !customerId) return [];
    const now = new Date().toISOString();
    return events
      .filter((e) => (e.attendeeIds ?? []).includes(customerId))
      .filter((e) => e.startsAt >= now)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [events, customerId]);

  const signIn = async (email: string) => {
    setSigningIn(true);
    setSignInError(undefined);
    try {
      const found = await customersApi.findByEmail(email);
      if (!found) {
        setSignInError("We couldn't find an account with that email.");
        return;
      }
      setCustomerId(found.id);
    } catch (err) {
      setSignInError(
        err instanceof Error ? err.message : "Sign-in failed. Try again.",
      );
    } finally {
      setSigningIn(false);
    }
  };

  const signOut = () => {
    setCustomerId("");
    setProfile(undefined);
    setEvents(undefined);
  };

  if (!customerId) {
    return <SignInCard onSignIn={signIn} busy={signingIn} error={signInError} />;
  }

  return (
    <div className="customer-page">
      <div className="customer-portal-head">
        <h1 className="customer-page__title">Your account</h1>
        <Button variant="secondary" onClick={signOut}>
          Sign out
        </Button>
      </div>

      {profileError ? (
        <div className="customer-error">
          {profileError}{" "}
          <button
            type="button"
            className="customer-error__retry"
            onClick={() => setCustomerId((c) => c)}
          >
            Retry
          </button>
        </div>
      ) : null}

      {profileLoading && !profile ? (
        <div className="customer-center">
          <Spinner label="Loading your account" />
        </div>
      ) : null}

      {profile ? (
        <div className="customer-grid customer-grid--2">
          <Card title="Profile">
            <dl className="customer-profile">
              <div>
                <dt>Name</dt>
                <dd>{profile.name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{profile.email}</dd>
              </div>
              {profile.phone ? (
                <div>
                  <dt>Phone</dt>
                  <dd>{profile.phone}</dd>
                </div>
              ) : null}
              {profile.address ? (
                <div>
                  <dt>Address</dt>
                  <dd>
                    {profile.address.line1}
                    {profile.address.line2 ? `, ${profile.address.line2}` : ""}
                    <br />
                    {profile.address.city}, {profile.address.state}{" "}
                    {profile.address.postalCode}
                    <br />
                    {profile.address.country}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>Membership</dt>
                <dd>
                  {profile.isMember ? (
                    <Tag>Active member</Tag>
                  ) : (
                    <Tag>Not a member</Tag>
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          <Card title="Your upcoming events">
            {eventsLoading && !events ? (
              <div className="customer-center">
                <Spinner label="Loading your events" />
              </div>
            ) : myEvents.length === 0 ? (
              <EmptyState
                icon="📅"
                title="You're not RSVP'd to any upcoming events"
                description="Browse the calendar or pickup events to reserve a spot."
              />
            ) : (
              <ul className="customer-event-list">
                {myEvents.map((event) => (
                  <li key={event.id} className="customer-event-list__item">
                    <div className="customer-event-list__when">
                      <span className="customer-event-list__date">
                        {formatDate(event.startsAt)}
                      </span>
                    </div>
                    <div className="customer-event-list__body">
                      <span className="customer-event-list__title">
                        {event.title}
                      </span>
                      <span className="customer-event-list__meta">
                        <Tag>{event.kind}</Tag>{" "}
                        {event.location ? `📍 ${event.location}` : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function SignInCard({
  onSignIn,
  busy,
  error,
}: {
  onSignIn: (email: string) => void;
  busy: boolean;
  error: string | undefined;
}): JSX.Element {
  const [email, setEmail] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSignIn(email);
  };
  return (
    <div className="customer-page customer-portal-signin">
      <Card title="Sign in to your account">
        <p className="customer-page__lede">
          Enter the email address on file to view your membership, profile,
          and the events you're attending.
        </p>
        <form className="customer-form" onSubmit={submit}>
          <label className="customer-field">
            <span className="customer-field__label">Email</span>
            <input
              className="customer-field__input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={busy}
              autoFocus
            />
          </label>
          {error ? <p className="customer-error">{error}</p> : null}
          <div className="customer-form__actions">
            <Button type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
