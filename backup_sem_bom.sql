--
-- PostgreSQL database dump
--

\restrict 4hRpPPDxuFz7fJW89v4Pcyr2j8SqzLTsjeWcEHmW37v4oEjjhQmSHpZnrLi8ZsX

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: appointment_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.appointment_status_enum AS ENUM (
    'scheduled',
    'confirmed',
    'cancelled_by_patient',
    'cancelled_by_therapist',
    'cancelled_by_admin',
    'proposed',
    'completed',
    'no_show',
    'rescheduled',
    'declined'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'paid',
    'failed',
    'refunded'
);


--
-- Name: transaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.transaction_type AS ENUM (
    'credit_purchase',
    'session_debit',
    'refund',
    'adjustment',
    'no_show_debit',
    'cancellation_refund'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'patient',
    'therapist',
    'company_admin',
    'admin'
);


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_profiles (
    id integer NOT NULL,
    user_id integer NOT NULL,
    full_name character varying(255) NOT NULL,
    phone character varying(20),
    cpf character varying(14),
    birth_date date,
    education_level character varying(100),
    foto_url character varying(500),
    department character varying(100),
    "position" character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


--
-- Name: admin_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_profiles_id_seq OWNED BY public.admin_profiles.id;


--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: appointment_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment_events (
    id integer NOT NULL,
    appointment_id integer NOT NULL,
    actor_user_id integer NOT NULL,
    event_type character varying(50) NOT NULL,
    old_status character varying(50),
    new_status character varying(50),
    event_metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: appointment_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.appointment_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: appointment_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.appointment_events_id_seq OWNED BY public.appointment_events.id;


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id integer NOT NULL,
    patient_user_id integer NOT NULL,
    therapist_user_id integer NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    status public.appointment_status_enum DEFAULT 'scheduled'::public.appointment_status_enum NOT NULL,
    rescheduled_from_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    session_price numeric(10,2),
    payment_status public.payment_status DEFAULT 'pending'::public.payment_status,
    wallet_id integer,
    duration_minutes integer DEFAULT 50,
    video_call_url character varying(500),
    google_calendar_event_id character varying(255)
);


--
-- Name: appointments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.appointments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: appointments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.appointments_id_seq OWNED BY public.appointments.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now(),
    user_id integer,
    user_role character varying(50),
    action_type character varying(50),
    old_value text,
    new_value text,
    appointment_id integer,
    therapist_profile_id integer,
    patient_profile_id integer,
    metadata jsonb,
    description character varying(500),
    ip_address character varying(50),
    user_agent character varying(255),
    extra_data jsonb
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: availability_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.availability_periods (
    id integer NOT NULL,
    therapist_profile_id integer,
    start_date date NOT NULL,
    end_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


--
-- Name: availability_periods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.availability_periods_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: availability_periods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.availability_periods_id_seq OWNED BY public.availability_periods.id;


--
-- Name: availability_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.availability_slots (
    id integer NOT NULL,
    period_id integer,
    weekday integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    CONSTRAINT availability_slots_weekday_check CHECK (((weekday >= 0) AND (weekday <= 6)))
);


--
-- Name: availability_slots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.availability_slots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: availability_slots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.availability_slots_id_seq OWNED BY public.availability_slots.id;


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id integer NOT NULL,
    thread_id integer NOT NULL,
    sender_id integer NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;


--
-- Name: chat_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_threads (
    id integer NOT NULL,
    patient_id integer,
    therapist_id integer,
    last_message_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    therapist_user_id integer,
    patient_user_id integer,
    updated_at timestamp with time zone
);


--
-- Name: chat_threads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_threads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_threads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_threads_id_seq OWNED BY public.chat_threads.id;


--
-- Name: commissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commissions (
    id integer NOT NULL,
    appointment_id integer NOT NULL,
    therapist_id integer NOT NULL,
    session_price numeric(10,2) NOT NULL,
    commission_rate numeric(5,2) NOT NULL,
    commission_amount numeric(10,2) NOT NULL,
    net_amount numeric(10,2) NOT NULL,
    is_refund boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE commissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.commissions IS 'Registro de comiss├ñes pagas por sess├åo';


--
-- Name: COLUMN commissions.commission_rate; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.commissions.commission_rate IS 'Taxa de comiss├åo em percentual (ex: 20 para 20%)';


--
-- Name: COLUMN commissions.net_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.commissions.net_amount IS 'Valor l┬íquido que o terapeuta recebe (session_price - commission_amount)';


--
-- Name: commissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: commissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.commissions_id_seq OWNED BY public.commissions.id;


--
-- Name: goal_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goal_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    is_active boolean DEFAULT true
);


--
-- Name: goal_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.goal_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: goal_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.goal_types_id_seq OWNED BY public.goal_types.id;


--
-- Name: ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ledger (
    id integer NOT NULL,
    wallet_id integer NOT NULL,
    appointment_id integer,
    transaction_type public.transaction_type NOT NULL,
    amount numeric(10,2) NOT NULL,
    balance_after numeric(10,2) NOT NULL,
    description text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT amount_non_zero CHECK ((amount <> (0)::numeric))
);


--
-- Name: ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ledger_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ledger_id_seq OWNED BY public.ledger.id;


--
-- Name: medical_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medical_records (
    id integer NOT NULL,
    appointment_id integer NOT NULL,
    session_not_occurred boolean DEFAULT false,
    not_occurred_reason text,
    evolution text,
    outcome character varying(50),
    patient_reasons jsonb,
    activity_instructions text,
    links jsonb,
    private_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ai_draft text
);


--
-- Name: medical_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.medical_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: medical_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.medical_records_id_seq OWNED BY public.medical_records.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    data jsonb,
    action_link character varying(500),
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: patient_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_addresses (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    street character varying(255) NOT NULL,
    number character varying(20),
    complement character varying(255),
    city character varying(100) NOT NULL,
    state character varying(2) NOT NULL,
    zipcode character varying(20) NOT NULL,
    country character varying(50) DEFAULT 'Brasil'::character varying,
    is_default boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    neighborhood character varying(100) NOT NULL,
    address_type character varying(50) DEFAULT 'residential'::character varying
);


--
-- Name: patient_addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.patient_addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patient_addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.patient_addresses_id_seq OWNED BY public.patient_addresses.id;


--
-- Name: patient_billing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_billing (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    payment_method character varying(50),
    billing_address_id integer,
    tax_id character varying(20),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: patient_billing_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.patient_billing_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patient_billing_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.patient_billing_id_seq OWNED BY public.patient_billing.id;


--
-- Name: patient_favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_favorites (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    therapist_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: patient_favorites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.patient_favorites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patient_favorites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.patient_favorites_id_seq OWNED BY public.patient_favorites.id;


--
-- Name: patient_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_goals (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    goal_type character varying(100) NOT NULL,
    is_active boolean DEFAULT true,
    selected_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    notes text,
    target_date date,
    created_at date DEFAULT CURRENT_DATE
);


--
-- Name: patient_goals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.patient_goals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patient_goals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.patient_goals_id_seq OWNED BY public.patient_goals.id;


--
-- Name: patient_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_profiles (
    id integer NOT NULL,
    user_id integer NOT NULL,
    full_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(50),
    cpf character varying(14),
    timezone character varying(50) DEFAULT 'America/Sao_Paulo'::character varying,
    preferred_language character varying(10) DEFAULT 'pt-BR'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    foto_url character varying(500),
    therapy_goals jsonb DEFAULT '[]'::jsonb,
    birth_date date,
    education_level character varying(100)
);


--
-- Name: patient_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.patient_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patient_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.patient_profiles_id_seq OWNED BY public.patient_profiles.id;


--
-- Name: patient_security; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_security (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    password_hash character varying(255) NOT NULL,
    recovery_email character varying(255),
    two_factor_enabled boolean DEFAULT false,
    last_login timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: patient_security_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.patient_security_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patient_security_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.patient_security_id_seq OWNED BY public.patient_security.id;


--
-- Name: patient_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_sessions (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    therapist_id integer NOT NULL,
    appointment_id integer,
    session_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    duration_minutes integer NOT NULL,
    therapist_name character varying(255) NOT NULL,
    therapist_specialty character varying(255),
    status character varying(50) NOT NULL,
    session_price numeric(10,2),
    video_call_url text,
    recording_url text,
    session_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: patient_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.patient_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patient_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.patient_sessions_id_seq OWNED BY public.patient_sessions.id;


--
-- Name: patient_statistics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_statistics (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    total_sessions integer DEFAULT 0,
    sessions_completed integer DEFAULT 0,
    sessions_cancelled integer DEFAULT 0,
    sessions_missed integer DEFAULT 0,
    sessions_rescheduled integer DEFAULT 0,
    sessions_last_7_days integer DEFAULT 0,
    sessions_last_30_days integer DEFAULT 0,
    sessions_last_90_days integer DEFAULT 0,
    last_session_date date,
    next_session_date date,
    total_with_therapist jsonb,
    favorite_therapist_id integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: patient_statistics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.patient_statistics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patient_statistics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.patient_statistics_id_seq OWNED BY public.patient_statistics.id;


--
-- Name: patient_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_subscriptions (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    plan_id character varying(50) NOT NULL,
    status character varying(50) NOT NULL,
    start_date date NOT NULL,
    end_date date,
    benefit_type character varying(100),
    coupon_id character varying(50),
    auto_renew boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: patient_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.patient_subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patient_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.patient_subscriptions_id_seq OWNED BY public.patient_subscriptions.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    wallet_id integer NOT NULL,
    stripe_payment_intent_id character varying(255),
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'BRL'::character varying NOT NULL,
    status public.payment_status DEFAULT 'pending'::public.payment_status NOT NULL,
    payment_method character varying(50),
    description text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    paid_at timestamp with time zone,
    refunded_at timestamp with time zone,
    stripe_session_id character varying(255),
    appointment_id integer,
    CONSTRAINT amount_positive CHECK ((amount > (0)::numeric))
);


--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: pending_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_bookings (
    id integer NOT NULL,
    user_id integer NOT NULL,
    therapist_id integer NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    session_price numeric(10,2) NOT NULL,
    current_balance numeric(10,2) NOT NULL,
    missing_amount numeric(10,2) NOT NULL,
    checkout_session_id character varying(255),
    payment_intent_id character varying(255),
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    extra_data jsonb
);


--
-- Name: pending_bookings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pending_bookings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pending_bookings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pending_bookings_id_seq OWNED BY public.pending_bookings.id;


--
-- Name: personal_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personal_events (
    id integer NOT NULL,
    therapist_id integer NOT NULL,
    type character varying(50) DEFAULT 'personal'::character varying NOT NULL,
    title character varying(255),
    patient_user_id integer,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


--
-- Name: personal_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.personal_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: personal_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.personal_events_id_seq OWNED BY public.personal_events.id;


--
-- Name: plan_features_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_features_config (
    id integer NOT NULL,
    feature_id character varying(100) NOT NULL,
    feature_name character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    available_in_essencial boolean DEFAULT false,
    available_in_profissional boolean DEFAULT false,
    available_in_premium boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: plan_features_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.plan_features_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plan_features_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.plan_features_config_id_seq OWNED BY public.plan_features_config.id;


--
-- Name: plan_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_prices (
    id integer NOT NULL,
    plan character varying(50) NOT NULL,
    price_cents integer NOT NULL,
    price_brl numeric(10,2) NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by integer
);


--
-- Name: plan_prices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.plan_prices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plan_prices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.plan_prices_id_seq OWNED BY public.plan_prices.id;


--
-- Name: session_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_documents (
    id integer NOT NULL,
    session_id integer NOT NULL,
    document_type character varying(50) NOT NULL,
    file_url text NOT NULL,
    file_name character varying(255),
    file_size integer,
    mime_type character varying(100),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: session_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.session_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: session_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.session_documents_id_seq OWNED BY public.session_documents.id;


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id integer NOT NULL,
    therapist_id integer NOT NULL,
    plan character varying(50) DEFAULT 'essencial'::character varying NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    stripe_subscription_id character varying(255),
    stripe_customer_id character varying(255),
    current_period_start timestamp without time zone,
    current_period_end timestamp without time zone,
    cancel_at_period_end boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE subscriptions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.subscriptions IS 'Planos de assinatura dos terapeutas';


--
-- Name: COLUMN subscriptions.plan; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.plan IS 'plano: essencial, profissional, premium';


--
-- Name: COLUMN subscriptions.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscriptions.status IS 'status: active, canceled, past_due';


--
-- Name: subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subscriptions_id_seq OWNED BY public.subscriptions.id;


--
-- Name: therapist_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.therapist_addresses (
    id integer NOT NULL,
    therapist_id integer NOT NULL,
    cep character varying(10),
    street character varying(255) NOT NULL,
    number character varying(20),
    complement character varying(255),
    neighborhood character varying(255) NOT NULL,
    city character varying(100) NOT NULL,
    state character varying(2) NOT NULL,
    country character varying(50) DEFAULT 'Brasil'::character varying,
    is_default boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: therapist_addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.therapist_addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: therapist_addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.therapist_addresses_id_seq OWNED BY public.therapist_addresses.id;


--
-- Name: therapist_availabilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.therapist_availabilities (
    id integer NOT NULL,
    weekday integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    therapist_profile_id integer NOT NULL
);


--
-- Name: therapist_availabilities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.therapist_availabilities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: therapist_availabilities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.therapist_availabilities_id_seq OWNED BY public.therapist_availabilities.id;


--
-- Name: therapist_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.therapist_documents (
    id integer NOT NULL,
    therapist_id integer NOT NULL,
    document_type character varying(50) NOT NULL,
    document_url character varying(500) NOT NULL,
    original_filename character varying(255) NOT NULL,
    file_size integer,
    uploaded_at timestamp with time zone DEFAULT now(),
    validation_status character varying(50) DEFAULT 'pending'::character varying,
    validated_by integer,
    validated_at timestamp with time zone,
    rejection_reason text
);


--
-- Name: therapist_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.therapist_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: therapist_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.therapist_documents_id_seq OWNED BY public.therapist_documents.id;


--
-- Name: therapist_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.therapist_invoices (
    id integer NOT NULL,
    therapist_id integer NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    invoice_number character varying(100) NOT NULL,
    invoice_date timestamp without time zone NOT NULL,
    invoice_url character varying(500) NOT NULL,
    amount numeric(10,2) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    admin_notes text,
    reviewed_by integer,
    reviewed_at timestamp without time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: therapist_invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.therapist_invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: therapist_invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.therapist_invoices_id_seq OWNED BY public.therapist_invoices.id;


--
-- Name: therapist_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.therapist_payments (
    id integer NOT NULL,
    therapist_id integer NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    commission_amount numeric(10,2) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    paid_at timestamp without time zone,
    paid_by integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: therapist_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.therapist_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: therapist_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.therapist_payments_id_seq OWNED BY public.therapist_payments.id;


--
-- Name: therapist_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.therapist_profiles (
    id integer NOT NULL,
    user_id integer NOT NULL,
    bio text,
    specialties character varying(255),
    session_price numeric(10,2),
    foto_url character varying(500),
    experiencia text,
    abordagem character varying(500),
    idiomas character varying(200),
    reviews_count integer DEFAULT 0,
    sessions_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    rating numeric(2,1) DEFAULT 0.0,
    gender character varying(50),
    ethnicity character varying(50),
    lgbtqia_ally boolean DEFAULT false,
    formation character varying(100),
    approaches jsonb,
    specialties_list jsonb,
    reasons jsonb,
    service_types jsonb,
    languages_list jsonb,
    rating_distribution jsonb,
    total_sessions integer DEFAULT 0,
    verified boolean DEFAULT false,
    featured boolean DEFAULT false,
    cancellation_policy text,
    session_duration_30min boolean DEFAULT true,
    session_duration_50min boolean DEFAULT true,
    instagram_url character varying(255),
    full_name character varying(255) NOT NULL,
    professional_registration character varying(100),
    treatment character varying(10),
    lgbtqia_belonging boolean DEFAULT false,
    phone character varying(20),
    birth_date date,
    show_phone_to_patients boolean DEFAULT false,
    show_birth_date_to_patients boolean DEFAULT false,
    signature_url character varying(500),
    video_url character varying(500),
    cnpj character varying(18),
    cpf character varying(14),
    bank_agency character varying(10),
    bank_account character varying(20),
    bank_account_digit character varying(2),
    pix_key_type character varying(20),
    pix_key character varying(100),
    lgpd_consent boolean DEFAULT false,
    lgpd_consent_date timestamp without time zone,
    cpf_masked character varying(14),
    payment_change_deadline character varying(50) DEFAULT 'last_day_of_month'::character varying,
    payment_change_deadline_message text,
    education_level character varying(100),
    chat_enabled boolean DEFAULT true,
    blocked_patients integer[] DEFAULT '{}'::integer[],
    stripe_customer_id character varying(255),
    google_calendar_token jsonb,
    google_calendar_enabled boolean DEFAULT false,
    validation_status character varying(50) DEFAULT 'pending'::character varying,
    is_verified boolean DEFAULT false
);


--
-- Name: COLUMN therapist_profiles.foto_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.therapist_profiles.foto_url IS 'URL da foto de perfil do terapeuta';


--
-- Name: COLUMN therapist_profiles.experiencia; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.therapist_profiles.experiencia IS 'Descri├º├úo da experi├¬ncia profissional';


--
-- Name: COLUMN therapist_profiles.abordagem; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.therapist_profiles.abordagem IS 'Abordagem terap├¬utica (separada por v├¡rgulas)';


--
-- Name: COLUMN therapist_profiles.idiomas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.therapist_profiles.idiomas IS 'Idiomas falados (separados por v├¡rgulas)';


--
-- Name: therapist_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.therapist_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: therapist_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.therapist_profiles_id_seq OWNED BY public.therapist_profiles.id;


--
-- Name: therapist_ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.therapist_ratings (
    id integer NOT NULL,
    therapist_id integer NOT NULL,
    patient_id integer NOT NULL,
    session_id integer,
    rating integer NOT NULL,
    comment text,
    is_anonymous boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT therapist_ratings_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: therapist_ratings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.therapist_ratings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: therapist_ratings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.therapist_ratings_id_seq OWNED BY public.therapist_ratings.id;


--
-- Name: therapist_validation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.therapist_validation (
    id integer NOT NULL,
    therapist_id integer NOT NULL,
    validation_status character varying(50) DEFAULT 'pending'::character varying,
    validated_by integer,
    validated_at timestamp with time zone,
    rejection_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: therapist_validation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.therapist_validation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: therapist_validation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.therapist_validation_id_seq OWNED BY public.therapist_validation.id;


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_permissions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    permission_id character varying(100) NOT NULL,
    granted boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_permissions_id_seq OWNED BY public.user_permissions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    full_name character varying(255),
    password_hash character varying(255),
    role public.user_role DEFAULT 'patient'::public.user_role NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    two_factor_enabled boolean DEFAULT false NOT NULL,
    email_notifications_enabled boolean DEFAULT true NOT NULL,
    email_preferences jsonb DEFAULT '{"email_changed": true, "password_reset": true, "invite_received": true, "payment_received": true, "appointment_created": true, "appointment_cancelled": true, "appointment_confirmed": true, "appointment_rescheduled": true}'::jsonb NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallets (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    balance numeric(10,2) DEFAULT 0.00 NOT NULL,
    currency character varying(3) DEFAULT 'BRL'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT balance_non_negative CHECK ((balance >= (0)::numeric))
);


--
-- Name: wallets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wallets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wallets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wallets_id_seq OWNED BY public.wallets.id;


--
-- Name: admin_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_profiles ALTER COLUMN id SET DEFAULT nextval('public.admin_profiles_id_seq'::regclass);


--
-- Name: appointment_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_events ALTER COLUMN id SET DEFAULT nextval('public.appointment_events_id_seq'::regclass);


--
-- Name: appointments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments ALTER COLUMN id SET DEFAULT nextval('public.appointments_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: availability_periods id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_periods ALTER COLUMN id SET DEFAULT nextval('public.availability_periods_id_seq'::regclass);


--
-- Name: availability_slots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_slots ALTER COLUMN id SET DEFAULT nextval('public.availability_slots_id_seq'::regclass);


--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);


--
-- Name: chat_threads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_threads ALTER COLUMN id SET DEFAULT nextval('public.chat_threads_id_seq'::regclass);


--
-- Name: commissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commissions ALTER COLUMN id SET DEFAULT nextval('public.commissions_id_seq'::regclass);


--
-- Name: goal_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_types ALTER COLUMN id SET DEFAULT nextval('public.goal_types_id_seq'::regclass);


--
-- Name: ledger id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger ALTER COLUMN id SET DEFAULT nextval('public.ledger_id_seq'::regclass);


--
-- Name: medical_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_records ALTER COLUMN id SET DEFAULT nextval('public.medical_records_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: patient_addresses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_addresses ALTER COLUMN id SET DEFAULT nextval('public.patient_addresses_id_seq'::regclass);


--
-- Name: patient_billing id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_billing ALTER COLUMN id SET DEFAULT nextval('public.patient_billing_id_seq'::regclass);


--
-- Name: patient_favorites id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_favorites ALTER COLUMN id SET DEFAULT nextval('public.patient_favorites_id_seq'::regclass);


--
-- Name: patient_goals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_goals ALTER COLUMN id SET DEFAULT nextval('public.patient_goals_id_seq'::regclass);


--
-- Name: patient_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_profiles ALTER COLUMN id SET DEFAULT nextval('public.patient_profiles_id_seq'::regclass);


--
-- Name: patient_security id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_security ALTER COLUMN id SET DEFAULT nextval('public.patient_security_id_seq'::regclass);


--
-- Name: patient_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_sessions ALTER COLUMN id SET DEFAULT nextval('public.patient_sessions_id_seq'::regclass);


--
-- Name: patient_statistics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_statistics ALTER COLUMN id SET DEFAULT nextval('public.patient_statistics_id_seq'::regclass);


--
-- Name: patient_subscriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.patient_subscriptions_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: pending_bookings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_bookings ALTER COLUMN id SET DEFAULT nextval('public.pending_bookings_id_seq'::regclass);


--
-- Name: personal_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_events ALTER COLUMN id SET DEFAULT nextval('public.personal_events_id_seq'::regclass);


--
-- Name: plan_features_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_features_config ALTER COLUMN id SET DEFAULT nextval('public.plan_features_config_id_seq'::regclass);


--
-- Name: plan_prices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_prices ALTER COLUMN id SET DEFAULT nextval('public.plan_prices_id_seq'::regclass);


--
-- Name: session_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_documents ALTER COLUMN id SET DEFAULT nextval('public.session_documents_id_seq'::regclass);


--
-- Name: subscriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions ALTER COLUMN id SET DEFAULT nextval('public.subscriptions_id_seq'::regclass);


--
-- Name: therapist_addresses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_addresses ALTER COLUMN id SET DEFAULT nextval('public.therapist_addresses_id_seq'::regclass);


--
-- Name: therapist_availabilities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_availabilities ALTER COLUMN id SET DEFAULT nextval('public.therapist_availabilities_id_seq'::regclass);


--
-- Name: therapist_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_documents ALTER COLUMN id SET DEFAULT nextval('public.therapist_documents_id_seq'::regclass);


--
-- Name: therapist_invoices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_invoices ALTER COLUMN id SET DEFAULT nextval('public.therapist_invoices_id_seq'::regclass);


--
-- Name: therapist_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_payments ALTER COLUMN id SET DEFAULT nextval('public.therapist_payments_id_seq'::regclass);


--
-- Name: therapist_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_profiles ALTER COLUMN id SET DEFAULT nextval('public.therapist_profiles_id_seq'::regclass);


--
-- Name: therapist_ratings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_ratings ALTER COLUMN id SET DEFAULT nextval('public.therapist_ratings_id_seq'::regclass);


--
-- Name: therapist_validation id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_validation ALTER COLUMN id SET DEFAULT nextval('public.therapist_validation_id_seq'::regclass);


--
-- Name: user_permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions ALTER COLUMN id SET DEFAULT nextval('public.user_permissions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: wallets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets ALTER COLUMN id SET DEFAULT nextval('public.wallets_id_seq'::regclass);


--
-- Data for Name: admin_profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admin_profiles (id, user_id, full_name, phone, cpf, birth_date, education_level, foto_url, department, "position", created_at, updated_at) FROM stdin;
1	6	Sigmund Freud	\N	\N	\N	\N	/uploads/admins/admin_6_ad1a51d840c8445da586dcff2e7e15d6.webp	Administra├º├úo	Administrador	2026-04-02 23:24:48.512548-03	2026-04-03 09:07:40.638509-03
\.


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alembic_version (version_num) FROM stdin;
ee0357f66880
\.


--
-- Data for Name: appointment_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.appointment_events (id, appointment_id, actor_user_id, event_type, old_status, new_status, event_metadata, created_at) FROM stdin;
1	2	110	created	\N	scheduled	\N	2026-03-22 11:32:14.092611-03
2	3	110	created	\N	scheduled	\N	2026-03-22 12:42:55.913533-03
3	4	110	created	\N	scheduled	\N	2026-03-22 12:45:04.488166-03
4	2	110	status_changed	scheduled	cancelled_by_patient	\N	2026-03-22 12:50:55.546982-03
5	3	110	status_changed	scheduled	cancelled_by_patient	\N	2026-03-22 12:50:59.141416-03
6	4	110	status_changed	scheduled	cancelled_by_patient	\N	2026-03-22 12:51:03.085864-03
7	5	110	created	\N	scheduled	\N	2026-03-22 12:51:15.088215-03
8	5	110	status_changed	scheduled	cancelled_by_patient	\N	2026-03-22 12:53:35.262116-03
9	6	110	created	\N	scheduled	\N	2026-03-22 12:54:26.823401-03
10	6	110	status_changed	scheduled	cancelled_by_patient	\N	2026-03-22 12:58:25.572735-03
11	7	110	created	\N	scheduled	\N	2026-03-22 12:59:03.725102-03
12	7	110	status_changed	scheduled	confirmed	\N	2026-03-22 12:59:04.819298-03
13	8	110	created	\N	scheduled	\N	2026-03-22 17:12:22.718575-03
14	8	110	status_changed	scheduled	confirmed	\N	2026-03-22 17:12:25.350419-03
15	9	110	created	\N	scheduled	\N	2026-03-22 17:12:56.725981-03
16	9	110	status_changed	scheduled	confirmed	\N	2026-03-22 17:12:56.851341-03
17	10	110	created	\N	scheduled	\N	2026-03-22 18:00:43.613509-03
18	11	110	created	\N	scheduled	\N	2026-03-22 18:03:22.827238-03
19	12	10	status_changed	proposed	cancelled_by_therapist	\N	2026-03-22 19:00:40.892996-03
20	13	10	status_changed	proposed	cancelled_by_therapist	\N	2026-03-22 19:09:17.462757-03
21	14	10	created	\N	proposed	\N	2026-03-22 19:10:06.465931-03
22	11	10	status_changed	confirmed	cancelled_by_therapist	\N	2026-03-22 19:16:21.537976-03
23	9	10	rescheduled	confirmed	rescheduled	{"new_appointment_id": 15}	2026-03-22 19:18:06.893807-03
24	16	10	created	\N	proposed	\N	2026-03-22 21:40:36.740368-03
25	17	10	created	\N	proposed	\N	2026-03-22 22:21:33.416819-03
26	14	110	status_changed	confirmed	cancelled_by_patient	\N	2026-03-22 23:41:52.823863-03
27	10	110	rescheduled	scheduled	rescheduled	{"new_appointment_id": 18}	2026-03-23 06:53:12.834327-03
28	19	110	created	\N	scheduled	\N	2026-03-23 10:31:19.651096-03
29	20	110	created	\N	scheduled	\N	2026-03-23 10:57:25.347539-03
30	21	110	created	\N	scheduled	\N	2026-03-23 11:00:51.682698-03
31	22	110	created	\N	scheduled	\N	2026-03-23 12:03:46.612843-03
32	22	10	status_changed	confirmed	cancelled_by_therapist	\N	2026-03-23 12:54:50.348146-03
33	15	10	rescheduled	scheduled	rescheduled	{"new_appointment_id": 23}	2026-03-23 13:28:27.536014-03
34	20	110	rescheduled	confirmed	rescheduled	{"new_appointment_id": 24}	2026-03-23 13:31:08.840029-03
35	25	110	created	\N	scheduled	\N	2026-03-23 16:12:28.300651-03
36	19	110	status_changed	scheduled	cancelled_by_patient	\N	2026-03-23 17:14:20.805137-03
37	23	110	status_changed	scheduled	cancelled_by_patient	\N	2026-03-23 18:36:16.03781-03
38	25	110	status_changed	confirmed	cancelled_by_patient	\N	2026-03-23 18:51:42.527766-03
39	21	10	status_changed	confirmed	cancelled_by_therapist	\N	2026-03-23 18:53:53.895098-03
40	26	110	created	\N	scheduled	\N	2026-03-23 19:16:54.483332-03
41	26	110	status_changed	scheduled	confirmed	\N	2026-03-23 19:16:56.516228-03
42	27	110	created	\N	scheduled	\N	2026-03-23 19:17:21.664173-03
43	27	110	status_changed	scheduled	confirmed	\N	2026-03-23 19:17:21.741815-03
44	27	110	status_changed	confirmed	cancelled_by_patient	\N	2026-03-23 19:24:44.291601-03
45	28	110	created	\N	scheduled	\N	2026-03-23 19:33:51.620323-03
46	28	110	status_changed	scheduled	confirmed	\N	2026-03-23 19:33:52.658718-03
47	28	110	status_changed	confirmed	cancelled_by_patient	\N	2026-03-23 19:34:23.413659-03
48	29	110	created	\N	scheduled	\N	2026-03-23 19:40:37.573456-03
49	29	110	status_changed	scheduled	confirmed	\N	2026-03-23 19:40:38.375219-03
50	29	110	status_changed	confirmed	cancelled_by_patient	\N	2026-03-23 19:41:09.115957-03
51	30	110	created	\N	scheduled	\N	2026-03-23 19:46:38.411574-03
52	30	110	status_changed	scheduled	confirmed	\N	2026-03-23 19:46:39.491315-03
53	30	110	status_changed	confirmed	cancelled_by_patient	\N	2026-03-23 19:47:07.833615-03
54	31	110	created	\N	scheduled	\N	2026-03-23 19:49:55.888341-03
55	31	110	status_changed	scheduled	confirmed	\N	2026-03-23 19:49:56.815234-03
56	31	110	status_changed	confirmed	cancelled_by_patient	\N	2026-03-23 19:50:12.374181-03
57	32	110	created	\N	scheduled	\N	2026-03-23 21:03:16.255101-03
58	32	110	status_changed	scheduled	confirmed	\N	2026-03-23 21:03:18.001684-03
59	33	110	created	\N	scheduled	\N	2026-03-23 21:03:30.683819-03
60	33	110	status_changed	confirmed	cancelled_by_patient	\N	2026-03-23 21:12:30.504874-03
61	34	110	created	\N	scheduled	\N	2026-03-23 21:20:31.634275-03
62	34	110	status_changed	scheduled	confirmed	\N	2026-03-23 21:20:32.439711-03
63	34	110	status_changed	confirmed	cancelled_by_patient	\N	2026-03-23 21:26:44.162193-03
64	35	110	created	\N	scheduled	\N	2026-03-25 23:02:55.133331-03
65	35	110	status_changed	scheduled	confirmed	\N	2026-03-25 23:02:57.518336-03
66	26	110	status_changed	confirmed	cancelled_by_patient	\N	2026-03-26 13:49:24.714823-03
67	36	110	created	\N	scheduled	\N	2026-03-26 13:49:55.20237-03
68	36	110	status_changed	scheduled	confirmed	\N	2026-03-26 13:49:56.96196-03
69	37	10	created	\N	proposed	\N	2026-03-27 17:58:57.8782-03
70	38	10	created	\N	scheduled	\N	2026-03-27 23:26:58.094285-03
71	38	110	status_changed	scheduled	cancelled_by_patient	\N	2026-03-27 23:29:09.79501-03
72	39	10	created	\N	scheduled	\N	2026-03-27 23:29:30.779865-03
73	39	110	status_changed	scheduled	confirmed	\N	2026-03-27 23:29:36.289204-03
74	39	110	status_changed	confirmed	cancelled_by_patient	\N	2026-03-27 23:33:05.720626-03
75	40	10	created	\N	scheduled	\N	2026-03-27 23:33:54.135382-03
76	40	110	status_changed	scheduled	confirmed	\N	2026-03-27 23:33:59.056764-03
77	40	110	status_changed	confirmed	cancelled_by_patient	\N	2026-03-27 23:36:38.725489-03
78	36	10	status_changed	confirmed	cancelled_by_therapist	\N	2026-03-28 22:51:10.413102-03
79	24	10	status_changed	scheduled	cancelled_by_therapist	\N	2026-03-28 22:51:12.231608-03
80	37	110	status_changed	proposed	cancelled_by_patient	\N	2026-03-29 23:01:54.59605-03
81	17	110	status_changed	proposed	confirmed	\N	2026-03-29 23:02:01.744749-03
82	41	110	created	\N	scheduled	\N	2026-03-30 14:40:32.355705-03
83	41	110	status_changed	scheduled	confirmed	\N	2026-03-30 14:40:36.184762-03
84	42	110	created	\N	scheduled	\N	2026-03-30 14:40:46.111058-03
85	42	110	status_changed	scheduled	confirmed	\N	2026-03-30 14:40:46.812872-03
86	43	110	created	\N	scheduled	\N	2026-03-30 19:31:12.665196-03
87	43	110	status_changed	scheduled	confirmed	\N	2026-03-30 19:31:16.062624-03
88	44	110	created	\N	scheduled	\N	2026-03-30 19:32:39.273705-03
89	45	10	created	\N	proposed	\N	2026-03-31 16:05:59.779855-03
91	47	10	created	\N	proposed	\N	2026-04-01 09:26:33.386538-03
92	48	110	created	\N	scheduled	\N	2026-04-01 14:56:15.941109-03
93	49	110	created	\N	scheduled	\N	2026-04-01 15:53:39.879648-03
94	50	110	created	\N	scheduled	\N	2026-04-01 15:55:31.290227-03
95	51	110	created	\N	scheduled	\N	2026-04-01 15:55:50.788841-03
96	52	110	created	\N	scheduled	\N	2026-04-01 15:57:05.962685-03
97	52	110	status_changed	confirmed	cancelled_by_patient	\N	2026-04-01 15:58:59.533344-03
98	53	110	created	\N	scheduled	\N	2026-04-01 15:59:11.61533-03
99	53	110	status_changed	scheduled	confirmed	\N	2026-04-01 15:59:13.453248-03
100	54	10	created	\N	proposed	\N	2026-04-01 17:10:48.301777-03
101	55	110	created	\N	scheduled	\N	2026-04-01 17:50:31.739212-03
102	56	110	created	\N	scheduled	\N	2026-04-01 18:06:28.944858-03
103	54	10	rescheduled	confirmed	rescheduled	{"new_appointment_id": 57}	2026-04-01 23:50:00.016723-03
104	58	110	created	\N	scheduled	\N	2026-04-03 11:31:15.389597-03
105	59	110	created	\N	scheduled	\N	2026-04-03 11:50:11.431707-03
106	60	110	created	\N	scheduled	\N	2026-04-03 11:50:55.505776-03
107	58	110	status_changed	scheduled	cancelled_by_patient	\N	2026-04-03 11:51:55.295804-03
108	59	110	status_changed	scheduled	cancelled_by_patient	\N	2026-04-03 11:51:59.385072-03
109	60	110	status_changed	scheduled	cancelled_by_patient	\N	2026-04-03 11:52:03.967858-03
110	61	110	created	\N	scheduled	\N	2026-04-03 11:53:13.395133-03
111	61	110	status_changed	scheduled	cancelled_by_patient	\N	2026-04-03 11:54:49.73313-03
112	62	110	created	\N	scheduled	\N	2026-04-03 11:56:06.238625-03
113	63	110	created	\N	scheduled	\N	2026-04-03 12:01:46.628481-03
114	64	110	created	\N	scheduled	\N	2026-04-03 12:03:57.145995-03
115	65	110	created	\N	scheduled	\N	2026-04-03 12:37:16.133478-03
116	62	110	status_changed	scheduled	cancelled_by_patient	\N	2026-04-03 12:38:24.711313-03
117	63	110	status_changed	scheduled	cancelled_by_patient	\N	2026-04-03 12:38:27.964755-03
118	64	110	status_changed	scheduled	cancelled_by_patient	\N	2026-04-03 12:38:32.685115-03
119	65	110	status_changed	scheduled	cancelled_by_patient	\N	2026-04-03 12:38:38.97733-03
120	50	110	status_changed	scheduled	cancelled_by_patient	\N	2026-04-03 12:38:45.134464-03
121	18	110	status_changed	scheduled	cancelled_by_patient	\N	2026-04-03 12:38:48.51234-03
122	66	110	created	\N	scheduled	\N	2026-04-03 12:57:17.502046-03
123	67	110	created	\N	scheduled	\N	2026-04-03 13:00:44.221386-03
127	70	110	created	\N	scheduled	\N	2026-04-04 07:04:28.166682-03
128	71	110	created	\N	scheduled	\N	2026-04-04 07:51:20.746062-03
129	72	110	created	\N	scheduled	\N	2026-04-04 07:58:06.165835-03
130	73	110	created	\N	scheduled	\N	2026-04-04 08:05:36.18395-03
131	73	110	status_changed	scheduled	cancelled_by_patient	\N	2026-04-04 08:10:45.706965-03
132	72	110	status_changed	scheduled	cancelled_by_patient	\N	2026-04-04 08:10:57.132287-03
133	71	110	status_changed	scheduled	cancelled_by_patient	\N	2026-04-04 08:12:17.82093-03
134	74	110	created	\N	scheduled	\N	2026-04-04 08:12:30.301954-03
135	75	110	created	\N	scheduled	\N	2026-04-04 08:28:41.420134-03
136	76	110	created	\N	scheduled	\N	2026-04-04 11:53:29.996183-03
137	77	110	created	\N	scheduled	\N	2026-04-04 12:53:44.243681-03
138	78	110	created	\N	scheduled	\N	2026-04-04 13:11:09.846095-03
139	79	110	created	\N	scheduled	\N	2026-04-04 13:25:36.889507-03
140	67	110	status_changed	scheduled	cancelled_by_patient	\N	2026-04-05 10:19:10.215938-03
141	66	110	status_changed	scheduled	cancelled_by_patient	\N	2026-04-05 10:19:15.015267-03
142	70	110	status_changed	scheduled	cancelled_by_patient	\N	2026-04-05 10:19:19.817572-03
143	76	110	status_changed	scheduled	cancelled_by_patient	\N	2026-04-05 10:19:22.547354-03
144	74	110	status_changed	scheduled	cancelled_by_patient	\N	2026-04-05 10:19:27.913578-03
145	75	110	status_changed	scheduled	cancelled_by_patient	\N	2026-04-05 10:19:31.071434-03
146	77	110	status_changed	scheduled	cancelled_by_patient	\N	2026-04-05 10:19:33.9015-03
147	78	110	status_changed	scheduled	cancelled_by_patient	\N	2026-04-05 10:19:37.11118-03
148	80	110	created	\N	scheduled	\N	2026-04-05 12:25:42.671225-03
149	81	110	created	\N	scheduled	\N	2026-04-05 12:51:31.113325-03
150	82	110	created	\N	scheduled	\N	2026-04-05 17:43:00.323764-03
151	7	10	rescheduled	confirmed	rescheduled	{"new_appointment_id": 83}	2026-04-06 15:07:41.627034-03
\.


--
-- Data for Name: appointments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.appointments (id, patient_user_id, therapist_user_id, starts_at, ends_at, status, rescheduled_from_id, created_at, session_price, payment_status, wallet_id, duration_minutes, video_call_url, google_calendar_event_id) FROM stdin;
2	110	10	2026-03-25 07:00:00-03	2026-03-25 07:50:00-03	cancelled_by_patient	\N	2026-03-22 11:32:14.092611-03	200.00	pending	\N	50	\N	\N
3	110	10	2026-04-04 07:00:00-03	2026-04-04 07:50:00-03	cancelled_by_patient	\N	2026-03-22 12:42:55.913533-03	200.00	pending	\N	50	\N	\N
4	110	10	2026-04-07 09:00:00-03	2026-04-07 09:50:00-03	cancelled_by_patient	\N	2026-03-22 12:45:04.488166-03	200.00	pending	\N	50	\N	\N
5	110	10	2026-03-25 07:00:00-03	2026-03-25 07:50:00-03	cancelled_by_patient	\N	2026-03-22 12:51:15.088215-03	200.00	pending	\N	50	\N	\N
6	110	10	2026-03-25 07:00:00-03	2026-03-25 07:50:00-03	cancelled_by_patient	\N	2026-03-22 12:54:26.823401-03	200.00	pending	\N	50	\N	\N
33	110	10	2026-04-07 07:00:00-03	2026-04-07 07:50:00-03	cancelled_by_patient	\N	2026-03-23 21:03:30.683819-03	200.00	pending	\N	50	\N	\N
12	110	10	2026-04-09 14:00:00-03	2026-04-09 14:50:00-03	cancelled_by_therapist	\N	2026-03-22 18:43:50.398012-03	\N	pending	\N	50	\N	\N
13	110	10	2026-04-09 14:00:00-03	2026-04-09 14:50:00-03	cancelled_by_therapist	\N	2026-03-22 19:01:04.896563-03	\N	pending	\N	50	\N	\N
11	110	10	2026-04-04 07:00:00-03	2026-04-04 07:50:00-03	cancelled_by_therapist	\N	2026-03-22 18:03:22.827238-03	200.00	pending	\N	50	\N	\N
9	110	10	2026-04-04 08:00:00-03	2026-04-04 08:50:00-03	rescheduled	\N	2026-03-22 17:12:56.725981-03	200.00	pending	\N	50	\N	\N
55	110	10	2026-04-14 08:00:00-03	2026-04-14 08:50:00-03	confirmed	\N	2026-04-01 17:50:31.739212-03	200.00	pending	\N	50	https://meet.google.com/aam-apdx-keq	\N
14	110	10	2026-04-09 15:00:00-03	2026-04-09 15:50:00-03	cancelled_by_patient	\N	2026-03-22 19:10:06.465931-03	200.00	pending	\N	50	\N	\N
10	110	10	2026-04-07 09:00:00-03	2026-04-07 09:50:00-03	rescheduled	\N	2026-03-22 18:00:43.613509-03	200.00	pending	\N	50	\N	\N
34	110	10	2026-04-07 07:00:00-03	2026-04-07 07:50:00-03	cancelled_by_patient	\N	2026-03-23 21:20:31.634275-03	200.00	pending	\N	50	\N	\N
22	110	10	2026-03-30 10:00:00-03	2026-03-30 10:50:00-03	cancelled_by_therapist	\N	2026-03-23 12:03:46.612843-03	200.00	pending	\N	50	\N	\N
15	110	10	2026-04-11 08:00:00-03	2026-04-11 08:50:00-03	rescheduled	9	2026-03-22 19:18:06.893807-03	200.00	pending	\N	50	\N	\N
20	110	10	2026-03-27 09:00:00-03	2026-03-27 09:50:00-03	rescheduled	\N	2026-03-23 10:57:25.347539-03	200.00	pending	\N	50	\N	\N
35	110	10	2026-04-07 07:00:00-03	2026-04-07 07:50:00-03	confirmed	\N	2026-03-25 23:02:55.133331-03	200.00	pending	\N	50	https://meet.google.com/pnm-vnbu-ibk	\N
19	110	10	2026-03-27 08:00:00-03	2026-03-27 08:50:00-03	cancelled_by_patient	\N	2026-03-23 10:31:19.651096-03	200.00	pending	\N	50	\N	\N
23	110	10	2026-04-07 10:00:00-03	2026-04-07 10:50:00-03	cancelled_by_patient	15	2026-03-23 13:28:27.536014-03	200.00	pending	\N	50	\N	\N
25	110	10	2026-03-30 07:00:00-03	2026-03-30 07:50:00-03	cancelled_by_patient	\N	2026-03-23 16:12:28.300651-03	200.00	pending	\N	50	\N	\N
21	110	10	2026-03-25 10:00:00-03	2026-03-25 10:50:00-03	cancelled_by_therapist	\N	2026-03-23 11:00:51.682698-03	200.00	pending	\N	50	\N	\N
26	110	10	2026-04-07 10:00:00-03	2026-04-07 10:50:00-03	cancelled_by_patient	\N	2026-03-23 19:16:54.483332-03	200.00	pending	\N	50	\N	\N
27	110	10	2026-04-07 08:00:00-03	2026-04-07 08:50:00-03	cancelled_by_patient	\N	2026-03-23 19:17:21.664173-03	200.00	pending	\N	50	\N	\N
28	110	10	2026-04-07 08:00:00-03	2026-04-07 08:50:00-03	cancelled_by_patient	\N	2026-03-23 19:33:51.620323-03	200.00	pending	\N	50	\N	\N
56	110	10	2026-04-14 09:00:00-03	2026-04-14 09:50:00-03	confirmed	\N	2026-04-01 18:06:28.944858-03	200.00	pending	\N	50	https://meet.google.com/upq-jdig-vxz	\N
29	110	10	2026-04-07 08:00:00-03	2026-04-07 08:50:00-03	cancelled_by_patient	\N	2026-03-23 19:40:37.573456-03	200.00	pending	\N	50	\N	\N
42	110	10	2026-04-09 09:00:00-03	2026-04-09 09:50:00-03	completed	\N	2026-03-30 14:40:46.111058-03	200.00	pending	\N	50	https://meet.google.com/axw-aqxe-spy	\N
30	110	10	2026-04-07 08:00:00-03	2026-04-07 08:50:00-03	cancelled_by_patient	\N	2026-03-23 19:46:38.411574-03	200.00	pending	\N	50	\N	\N
31	110	10	2026-04-07 08:00:00-03	2026-04-07 08:50:00-03	cancelled_by_patient	\N	2026-03-23 19:49:55.888341-03	200.00	pending	\N	50	\N	\N
54	110	10	2026-04-01 18:00:00-03	2026-04-01 18:50:00-03	rescheduled	\N	2026-04-01 17:10:48.301777-03	200.00	pending	\N	50	https://meet.google.com/bqz-ywib-vaf	\N
38	110	10	2026-03-30 07:00:00-03	2026-03-30 07:50:00-03	cancelled_by_patient	\N	2026-03-27 23:26:58.094285-03	200.00	pending	\N	50	\N	\N
39	110	10	2026-03-30 07:00:00-03	2026-03-30 07:50:00-03	cancelled_by_patient	\N	2026-03-27 23:29:30.779865-03	200.00	pending	\N	50	https://meet.google.com/ovz-ccxe-dmp	\N
57	110	10	2026-04-14 10:00:00-03	2026-04-14 10:50:00-03	confirmed	54	2026-04-01 23:50:00.016723-03	200.00	pending	\N	50	\N	\N
40	110	10	2026-03-30 07:00:00-03	2026-03-30 07:50:00-03	cancelled_by_patient	\N	2026-03-27 23:33:54.135382-03	200.00	pending	\N	50	https://meet.google.com/utn-crcw-wue	\N
36	110	10	2026-04-07 10:00:00-03	2026-04-07 10:50:00-03	cancelled_by_therapist	\N	2026-03-26 13:49:55.20237-03	200.00	pending	\N	50	https://meet.google.com/eib-iqpc-izs	\N
24	110	10	2026-04-07 09:00:00-03	2026-04-07 09:50:00-03	cancelled_by_therapist	20	2026-03-23 13:31:08.840029-03	200.00	pending	\N	50	\N	\N
37	110	10	2026-03-28 10:00:00-03	2026-03-28 10:50:00-03	cancelled_by_patient	\N	2026-03-27 17:58:57.8782-03	200.00	pending	\N	50	\N	\N
17	110	10	2026-04-09 10:00:00-03	2026-04-09 10:50:00-03	confirmed	\N	2026-03-22 22:21:33.416819-03	200.00	pending	\N	50	https://meet.google.com/jfi-uwwr-poi	\N
44	110	10	2026-04-16 07:00:00-03	2026-04-16 07:50:00-03	confirmed	\N	2026-03-30 19:32:39.273705-03	200.00	pending	\N	50	https://meet.google.com/xja-xetn-upu	\N
41	110	10	2026-04-09 08:00:00-03	2026-04-09 08:50:00-03	confirmed	\N	2026-03-30 14:40:32.355705-03	200.00	pending	\N	50	https://meet.google.com/tzm-msfe-vpv	\N
51	110	10	2026-04-09 09:00:00-03	2026-04-09 09:50:00-03	confirmed	\N	2026-04-01 15:55:50.788841-03	200.00	pending	\N	50	https://meet.google.com/kmp-saci-knt	\N
45	110	10	2026-04-02 07:00:00-03	2026-04-02 07:50:00-03	completed	\N	2026-03-31 16:05:59.779855-03	200.00	pending	\N	50	https://meet.google.com/bzf-keax-mks	\N
43	110	10	2026-04-07 09:00:00-03	2026-04-07 09:50:00-03	completed	\N	2026-03-30 19:31:12.665196-03	200.00	pending	\N	50	https://meet.google.com/nun-hghn-zua	\N
52	110	10	2026-04-14 07:00:00-03	2026-04-14 07:50:00-03	cancelled_by_patient	\N	2026-04-01 15:57:05.962685-03	200.00	pending	\N	50	\N	\N
47	110	10	2026-04-02 16:00:00-03	2026-04-02 16:50:00-03	confirmed	\N	2026-04-01 09:26:33.386538-03	200.00	pending	\N	50	https://meet.google.com/qrp-ddzb-sct	\N
53	110	10	2026-04-14 07:00:00-03	2026-04-14 07:50:00-03	confirmed	\N	2026-04-01 15:59:11.61533-03	200.00	pending	\N	50	https://meet.google.com/hcg-wgqu-opc	\N
49	110	10	2026-04-02 09:00:00-03	2026-04-02 09:50:00-03	completed	\N	2026-04-01 15:53:39.879648-03	200.00	pending	\N	50	https://meet.google.com/ykf-cniq-hth	\N
48	110	10	2026-04-02 08:00:00-03	2026-04-02 08:50:00-03	completed	\N	2026-04-01 14:56:15.941109-03	200.00	pending	\N	50	https://meet.google.com/jrq-twcs-res	\N
7	110	10	2026-03-25 07:00:00-03	2026-03-25 07:50:00-03	rescheduled	\N	2026-03-22 12:59:03.725102-03	200.00	pending	\N	50	https://meet.google.com/qqa-qcvm-imh	\N
32	110	10	2026-04-07 08:00:00-03	2026-04-07 08:50:00-03	completed	\N	2026-03-23 21:03:16.255101-03	200.00	pending	\N	50	https://meet.google.com/gct-sewp-adw	\N
58	110	10	2026-04-16 08:00:00-03	2026-04-16 08:50:00-03	cancelled_by_patient	\N	2026-04-03 11:31:15.389597-03	200.00	pending	\N	50	\N	\N
59	110	10	2026-04-16 09:00:00-03	2026-04-16 09:50:00-03	cancelled_by_patient	\N	2026-04-03 11:50:11.431707-03	200.00	pending	\N	50	\N	\N
60	110	10	2026-04-16 10:00:00-03	2026-04-16 10:50:00-03	cancelled_by_patient	\N	2026-04-03 11:50:55.505776-03	200.00	pending	\N	50	\N	\N
61	110	10	2026-04-16 08:00:00-03	2026-04-16 08:50:00-03	cancelled_by_patient	\N	2026-04-03 11:53:13.395133-03	200.00	pending	\N	50	\N	\N
62	110	10	2026-04-16 08:00:00-03	2026-04-16 08:50:00-03	cancelled_by_patient	\N	2026-04-03 11:56:06.238625-03	200.00	pending	\N	50	\N	\N
63	110	10	2026-04-16 09:00:00-03	2026-04-16 09:50:00-03	cancelled_by_patient	\N	2026-04-03 12:01:46.628481-03	200.00	pending	\N	50	\N	\N
64	110	10	2026-04-16 10:00:00-03	2026-04-16 10:50:00-03	cancelled_by_patient	\N	2026-04-03 12:03:57.145995-03	200.00	pending	\N	50	\N	\N
65	110	10	2026-04-21 07:00:00-03	2026-04-21 07:50:00-03	cancelled_by_patient	\N	2026-04-03 12:37:16.133478-03	200.00	pending	\N	50	\N	\N
50	110	10	2026-04-07 10:00:00-03	2026-04-07 10:50:00-03	cancelled_by_patient	\N	2026-04-01 15:55:31.290227-03	200.00	pending	\N	50	\N	\N
18	110	10	2026-04-09 07:00:00-03	2026-04-09 07:50:00-03	cancelled_by_patient	10	2026-03-23 06:53:12.834327-03	200.00	pending	\N	50	\N	\N
8	110	10	2026-04-02 14:00:00-03	2026-04-02 14:50:00-03	completed	\N	2026-03-22 17:12:22.718575-03	200.00	pending	\N	50	https://meet.google.com/gyg-uiqh-wfx	\N
67	110	10	2026-04-09 07:00:00-03	2026-04-09 07:50:00-03	cancelled_by_patient	\N	2026-04-03 13:00:44.221386-03	200.00	pending	\N	50	\N	\N
66	110	10	2026-04-07 10:00:00-03	2026-04-07 10:50:00-03	cancelled_by_patient	\N	2026-04-03 12:57:17.502046-03	200.00	pending	\N	50	\N	\N
70	110	10	2026-04-16 09:00:00-03	2026-04-16 09:50:00-03	cancelled_by_patient	\N	2026-04-04 07:04:28.166682-03	200.00	pending	\N	50	\N	\N
16	110	10	2026-03-27 07:00:00-03	2026-03-27 07:50:00-03	completed	\N	2026-03-22 21:40:36.740368-03	200.00	pending	\N	50	https://meet.google.com/rtt-vbba-usy	\N
73	110	10	2026-04-21 08:00:00-03	2026-04-21 08:50:00-03	cancelled_by_patient	\N	2026-04-04 08:05:36.18395-03	200.00	pending	\N	50	\N	\N
72	110	10	2026-04-21 07:00:00-03	2026-04-21 07:50:00-03	cancelled_by_patient	\N	2026-04-04 07:58:06.165835-03	200.00	pending	\N	50	\N	\N
71	110	10	2026-04-16 10:00:00-03	2026-04-16 10:50:00-03	cancelled_by_patient	\N	2026-04-04 07:51:20.746062-03	200.00	pending	\N	50	\N	\N
79	110	10	2026-04-23 07:00:00-03	2026-04-23 07:50:00-03	confirmed	\N	2026-04-04 13:25:36.889507-03	200.00	pending	\N	50	https://meet.google.com/cut-koga-uvu	\N
76	110	10	2026-04-16 10:00:00-03	2026-04-16 10:50:00-03	cancelled_by_patient	\N	2026-04-04 11:53:29.996183-03	200.00	pending	\N	50	\N	\N
74	110	10	2026-04-21 07:00:00-03	2026-04-21 07:50:00-03	cancelled_by_patient	\N	2026-04-04 08:12:30.301954-03	200.00	pending	\N	50	\N	\N
75	110	10	2026-04-21 08:00:00-03	2026-04-21 08:50:00-03	cancelled_by_patient	\N	2026-04-04 08:28:41.420134-03	200.00	pending	\N	50	\N	\N
77	110	10	2026-04-21 09:00:00-03	2026-04-21 09:50:00-03	cancelled_by_patient	\N	2026-04-04 12:53:44.243681-03	200.00	pending	\N	50	\N	\N
78	110	10	2026-04-21 10:00:00-03	2026-04-21 10:50:00-03	cancelled_by_patient	\N	2026-04-04 13:11:09.846095-03	200.00	pending	\N	50	\N	\N
81	110	10	2026-04-09 07:00:00-03	2026-04-09 07:50:00-03	confirmed	\N	2026-04-05 12:51:31.113325-03	200.00	pending	\N	50	https://meet.google.com/inn-nzsy-huf	\N
82	110	10	2026-04-16 08:00:00-03	2026-04-16 08:50:00-03	confirmed	\N	2026-04-05 17:43:00.323764-03	200.00	pending	\N	50	https://meet.google.com/jmh-oeuq-otc	\N
83	110	10	2026-04-16 09:00:00-03	2026-04-16 09:50:00-03	confirmed	7	2026-04-06 15:07:41.627034-03	200.00	pending	\N	50	https://meet.google.com/mtq-baxf-qhf	\N
80	110	10	2026-04-07 10:00:00-03	2026-04-07 10:50:00-03	completed	\N	2026-04-05 12:25:42.671225-03	200.00	pending	\N	50	https://meet.google.com/bmi-cfry-kkh	\N
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_logs (id, "timestamp", user_id, user_role, action_type, old_value, new_value, appointment_id, therapist_profile_id, patient_profile_id, metadata, description, ip_address, user_agent, extra_data) FROM stdin;
1	2026-03-22 12:59:04.789734-03	110	patient	session_debit	600.0	400.0	7	3	103	\N	D├®bito de R$ 200.0 pela sess├úo 7. Saldo: 600.0 ÔåÆ 400.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"new_balance": 400.0, "old_balance": 600.0, "session_price": 200.0}
2	2026-03-22 17:12:25.275568-03	110	patient	session_debit	400.0	200.0	8	3	103	\N	D├®bito de R$ 200.0 pela sess├úo 8. Saldo: 400.0 ÔåÆ 200.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"new_balance": 200.0, "old_balance": 400.0, "session_price": 200.0}
3	2026-03-22 17:12:56.829919-03	110	patient	session_debit	200.0	0.0	9	3	103	\N	D├®bito de R$ 200.0 pela sess├úo 9. Saldo: 200.0 ÔåÆ 0.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"new_balance": 0.0, "old_balance": 200.0, "session_price": 200.0}
4	2026-03-22 17:48:58.142151-03	110	patient	insufficient_balance_attempt	0.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 0.00	127.0.0.1	node	{"starts_at": "2026-04-07 09:00:00-03:00", "therapist_id": 10}
5	2026-03-22 18:00:43.551247-03	110	patient	insufficient_balance_attempt	0.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 0.00	127.0.0.1	node	{"starts_at": "2026-04-07 09:00:00-03:00", "therapist_id": 10}
6	2026-03-22 18:03:22.791583-03	110	patient	insufficient_balance_attempt	0.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 0.00	127.0.0.1	node	{"starts_at": "2026-04-04 07:00:00-03:00", "therapist_id": 10}
7	2026-03-23 10:31:19.349784-03	110	patient	insufficient_balance_attempt	0.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 0.00	127.0.0.1	node	{"starts_at": "2026-03-27 08:00:00-03:00", "therapist_id": 3}
8	2026-03-23 10:57:25.314883-03	110	patient	insufficient_balance_attempt	0.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 0.00	127.0.0.1	node	{"starts_at": "2026-03-27 09:00:00-03:00", "therapist_id": 3}
9	2026-03-23 11:00:51.657495-03	110	patient	insufficient_balance_attempt	0.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 0.00	127.0.0.1	node	{"starts_at": "2026-03-25 10:00:00-03:00", "therapist_id": 3}
10	2026-03-23 12:03:46.526846-03	110	patient	insufficient_balance_attempt	0.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 0.00	127.0.0.1	node	{"starts_at": "2026-03-30 10:00:00-03:00", "therapist_id": 3}
11	2026-03-23 16:12:28.090771-03	110	patient	insufficient_balance_attempt	0.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 0.00	127.0.0.1	node	{"starts_at": "2026-03-30 07:00:00-03:00", "therapist_id": 3}
12	2026-03-23 18:51:42.022284-03	110	patient	session_refund	0.0	200.0	25	3	103	\N	Estorno de R$ 200.0 pela sess├úo 25. Motivo: Cancelamento com 24h+. Saldo: 0.0 ÔåÆ 200.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"reason": "Cancelamento com 24h+", "new_balance": 200.0, "old_balance": 0.0, "refund_amount": 200.0}
13	2026-03-23 18:53:53.876514-03	10	therapist	session_refund	200.0	400.0	21	3	103	\N	Estorno de R$ 200.0 pela sess├úo 21. Motivo: Cancelamento por terapeuta. Saldo: 200.0 ÔåÆ 400.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0	{"reason": "Cancelamento por terapeuta", "new_balance": 400.0, "old_balance": 200.0, "refund_amount": 200.0}
14	2026-03-23 19:16:56.489179-03	110	patient	session_debit	400.0	200.0	26	3	103	\N	D├®bito de R$ 200.0 pela sess├úo 26. Saldo: 400.0 ÔåÆ 200.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"new_balance": 200.0, "old_balance": 400.0, "session_price": 200.0}
15	2026-03-23 19:17:21.72793-03	110	patient	session_debit	200.0	0.0	27	3	103	\N	D├®bito de R$ 200.0 pela sess├úo 27. Saldo: 200.0 ÔåÆ 0.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"new_balance": 0.0, "old_balance": 200.0, "session_price": 200.0}
16	2026-03-23 19:24:44.267269-03	110	patient	session_refund	0.0	200.0	27	3	103	\N	Estorno de R$ 200.0 pela sess├úo 27. Motivo: Cancelamento com 24h+. Saldo: 0.0 ÔåÆ 200.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"reason": "Cancelamento com 24h+", "new_balance": 200.0, "old_balance": 0.0, "refund_amount": 200.0}
17	2026-03-23 19:33:52.627192-03	110	patient	session_debit	200.0	0.0	28	3	103	\N	D├®bito de R$ 200.0 pela sess├úo 28. Saldo: 200.0 ÔåÆ 0.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"new_balance": 0.0, "old_balance": 200.0, "session_price": 200.0}
18	2026-03-23 19:34:23.397144-03	110	patient	session_refund	0.0	200.0	28	3	103	\N	Estorno de R$ 200.0 pela sess├úo 28. Motivo: Cancelamento com 24h+. Saldo: 0.0 ÔåÆ 200.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"reason": "Cancelamento com 24h+", "new_balance": 200.0, "old_balance": 0.0, "refund_amount": 200.0}
19	2026-03-23 19:40:38.359196-03	110	patient	session_debit	200.0	0.0	29	3	103	\N	D├®bito de R$ 200.0 pela sess├úo 29. Saldo: 200.0 ÔåÆ 0.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"new_balance": 0.0, "old_balance": 200.0, "session_price": 200.0}
20	2026-03-23 19:41:09.098296-03	110	patient	session_refund	0.0	200.0	29	3	103	\N	Estorno de R$ 200.0 pela sess├úo 29. Motivo: Cancelamento com 24h+. Saldo: 0.0 ÔåÆ 200.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"reason": "Cancelamento com 24h+", "new_balance": 200.0, "old_balance": 0.0, "refund_amount": 200.0}
21	2026-03-23 19:46:39.473123-03	110	patient	session_debit	200.0	0.0	30	3	103	\N	D├®bito de R$ 200.0 pela sess├úo 30. Saldo: 200.0 ÔåÆ 0.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"new_balance": 0.0, "old_balance": 200.0, "session_price": 200.0}
22	2026-03-23 19:47:07.812827-03	110	patient	session_refund	0.0	200.0	30	3	103	\N	Estorno de R$ 200.0 pela sess├úo 30. Motivo: Cancelamento com 24h+. Saldo: 0.0 ÔåÆ 200.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"reason": "Cancelamento com 24h+", "new_balance": 200.0, "old_balance": 0.0, "refund_amount": 200.0}
23	2026-03-23 19:49:56.796373-03	110	patient	session_debit	200.0	0.0	31	3	103	\N	D├®bito de R$ 200.0 pela sess├úo 31. Saldo: 200.0 ÔåÆ 0.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"new_balance": 0.0, "old_balance": 200.0, "session_price": 200.0}
24	2026-03-23 19:50:12.335873-03	110	patient	session_refund	0.0	200.0	31	3	103	\N	Estorno de R$ 200.0 pela sess├úo 31. Motivo: Cancelamento com 24h+. Saldo: 0.0 ÔåÆ 200.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"reason": "Cancelamento com 24h+", "new_balance": 200.0, "old_balance": 0.0, "refund_amount": 200.0}
25	2026-03-23 21:03:17.980787-03	110	patient	session_debit	200.0	0.0	32	3	103	\N	D├®bito de R$ 200.0 pela sess├úo 32. Saldo: 200.0 ÔåÆ 0.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"new_balance": 0.0, "old_balance": 200.0, "session_price": 200.0}
27	2026-03-23 21:12:30.48908-03	110	patient	session_refund	0.0	200.0	33	3	103	\N	Estorno de R$ 200.0 pela sess├úo 33. Motivo: Cancelamento com 24h+. Saldo: 0.0 ÔåÆ 200.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"reason": "Cancelamento com 24h+", "new_balance": 200.0, "old_balance": 0.0, "refund_amount": 200.0}
28	2026-03-23 21:20:32.425243-03	110	patient	session_debit	200.0	0.0	34	3	103	\N	D├®bito de R$ 200.0 pela sess├úo 34. Saldo: 200.0 ÔåÆ 0.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"new_balance": 0.0, "old_balance": 200.0, "session_price": 200.0}
29	2026-03-23 21:26:44.140364-03	110	patient	session_refund	0.0	200.0	34	3	103	\N	Estorno de R$ 200.0 pela sess├úo 34. Motivo: Cancelamento com 24h+. Saldo: 0.0 ÔåÆ 200.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"reason": "Cancelamento com 24h+", "new_balance": 200.0, "old_balance": 0.0, "refund_amount": 200.0}
26	2026-03-23 21:03:30.63256-03	110	patient	insufficient_balance_attempt	0.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 0.00	127.0.0.1	node	{"starts_at": "2026-04-07 07:00:00-03:00", "therapist_id": 10}
30	2026-03-25 23:02:55.26412-03	110	patient	session_debit	200.0	0.0	35	3	103	\N	D├®bito de R$ 200.0 pela sess├úo 35. Saldo: 200.0 ÔåÆ 0.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"new_balance": 0.0, "old_balance": 200.0, "session_price": 200.0}
31	2026-03-26 13:49:23.881478-03	110	patient	session_refund	0.0	200.0	26	3	103	\N	Estorno de R$ 200.0 pela sess├úo 26. Motivo: Cancelamento com 24h+. Saldo: 0.0 ÔåÆ 200.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"reason": "Cancelamento com 24h+", "new_balance": 200.0, "old_balance": 0.0, "refund_amount": 200.0}
32	2026-03-26 13:49:55.285383-03	110	patient	session_debit	200.0	0.0	36	3	103	\N	D├®bito de R$ 200.0 pela sess├úo 36. Saldo: 200.0 ÔåÆ 0.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"new_balance": 0.0, "old_balance": 200.0, "session_price": 200.0}
33	2026-03-27 23:29:34.956906-03	110	patient	session_debit	200.0	0.0	39	3	103	\N	D├®bito de R$ 200.0 pela sess├úo 39. Saldo: 200.0 ÔåÆ 0.0	127.0.0.1	python-requests/2.32.5	{"new_balance": 0.0, "old_balance": 200.0, "session_price": 200.0}
34	2026-03-27 23:33:05.699884-03	110	patient	session_refund	500.0	700.0	39	3	103	\N	Estorno de R$ 200.0 pela sess├úo 39. Motivo: Cancelamento com 24h+. Saldo: 500.0 ÔåÆ 700.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"reason": "Cancelamento com 24h+", "new_balance": 700.0, "old_balance": 500.0, "refund_amount": 200.0}
35	2026-03-27 23:33:58.306625-03	110	patient	session_debit	700.0	500.0	40	3	103	\N	D├®bito de R$ 200.0 pela sess├úo 40. Saldo: 700.0 ÔåÆ 500.0	127.0.0.1	python-requests/2.32.5	{"new_balance": 500.0, "old_balance": 700.0, "session_price": 200.0}
36	2026-03-27 23:36:38.609674-03	110	patient	session_refund	500.0	700.0	40	3	103	\N	Estorno de R$ 200.0 pela sess├úo 40. Motivo: Cancelamento com 24h+. Saldo: 500.0 ÔåÆ 700.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"reason": "Cancelamento com 24h+", "new_balance": 700.0, "old_balance": 500.0, "refund_amount": 200.0}
37	2026-03-28 22:51:07.616686-03	10	therapist	session_refund	700.0	900.0	36	3	103	\N	Estorno de R$ 200.0 pela sess├úo 36. Motivo: Cancelamento por terapeuta. Saldo: 700.0 ÔåÆ 900.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0	{"reason": "Cancelamento por terapeuta", "new_balance": 900.0, "old_balance": 700.0, "refund_amount": 200.0}
38	2026-03-29 23:01:59.833983-03	110	patient	session_debit	900.0	700.0	17	3	103	\N	D├®bito de R$ 200.0 pela sess├úo 17. Saldo: 900.0 ÔåÆ 700.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"new_balance": 700.0, "old_balance": 900.0, "session_price": 200.0}
39	2026-03-30 14:40:32.676721-03	110	patient	session_debit	700.0	500.0	41	3	103	\N	D├®bito de R$ 200.0 pela sess├úo 41. Saldo: 700.0 ÔåÆ 500.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"new_balance": 500.0, "old_balance": 700.0, "session_price": 200.0}
40	2026-03-30 14:40:46.173448-03	110	patient	session_debit	500.0	300.0	42	3	103	\N	D├®bito de R$ 200.0 pela sess├úo 42. Saldo: 500.0 ÔåÆ 300.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"new_balance": 300.0, "old_balance": 500.0, "session_price": 200.0}
41	2026-03-30 19:31:12.951121-03	110	patient	session_debit	300.0	100.0	43	3	103	\N	D├®bito de R$ 200.0 pela sess├úo 43. Saldo: 300.0 ÔåÆ 100.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"new_balance": 100.0, "old_balance": 300.0, "session_price": 200.0}
42	2026-03-30 19:32:39.243537-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"starts_at": "2026-04-16 07:00:00-03:00", "therapist_id": 10}
43	2026-04-01 14:56:15.812728-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"starts_at": "2026-04-02 08:00:00-03:00", "therapist_id": 10}
44	2026-04-01 15:53:39.81182-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"starts_at": "2026-04-02 09:00:00-03:00", "therapist_id": 10}
45	2026-04-01 15:55:31.256772-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"starts_at": "2026-04-07 10:00:00-03:00", "therapist_id": 10}
46	2026-04-01 15:55:50.777212-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"starts_at": "2026-04-09 09:00:00-03:00", "therapist_id": 10}
47	2026-04-01 15:57:05.882598-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"starts_at": "2026-04-14 07:00:00-03:00", "therapist_id": 10}
48	2026-04-01 15:58:59.205054-03	110	patient	session_refund	100.0	300.0	52	3	103	\N	Estorno de R$ 200.0 pela sess├úo 52. Motivo: Cancelamento com 24h+. Saldo: 100.0 ÔåÆ 300.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"reason": "Cancelamento com 24h+", "new_balance": 300.0, "old_balance": 100.0, "refund_amount": 200.0}
49	2026-04-01 15:59:12.170005-03	110	patient	session_debit	300.0	100.0	53	3	103	\N	D├®bito de R$ 200.0 pela sess├úo 53. Saldo: 300.0 ÔåÆ 100.0	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"new_balance": 100.0, "old_balance": 300.0, "session_price": 200.0}
50	2026-04-01 17:50:31.594267-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"starts_at": "2026-04-14 08:00:00-03:00", "therapist_id": 10}
51	2026-04-01 18:06:28.830235-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"starts_at": "2026-04-14 09:00:00-03:00", "therapist_id": 10}
52	2026-04-03 11:31:15.286569-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"starts_at": "2026-04-16 11:00:00+00:00", "therapist_id": 10}
53	2026-04-03 11:50:11.409986-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"starts_at": "2026-04-16 12:00:00+00:00", "therapist_id": 10}
54	2026-04-03 11:50:55.492577-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"starts_at": "2026-04-16 13:00:00+00:00", "therapist_id": 10}
55	2026-04-03 11:53:13.380635-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"starts_at": "2026-04-16 11:00:00+00:00", "therapist_id": 10}
56	2026-04-03 11:56:06.225215-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"starts_at": "2026-04-16 11:00:00+00:00", "therapist_id": 10}
57	2026-04-03 12:01:46.610357-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"starts_at": "2026-04-16 12:00:00+00:00", "therapist_id": 10}
58	2026-04-03 12:03:57.114518-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"starts_at": "2026-04-16 13:00:00+00:00", "therapist_id": 10}
59	2026-04-03 12:37:16.112071-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"starts_at": "2026-04-21 10:00:00+00:00", "therapist_id": 10}
60	2026-04-03 12:57:17.489365-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"starts_at": "2026-04-07 13:00:00+00:00", "therapist_id": 10}
61	2026-04-03 13:00:44.203691-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	{"starts_at": "2026-04-09 07:00:00-03:00", "therapist_id": 10}
62	2026-04-04 07:04:27.219072-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	{"starts_at": "2026-04-16 09:00:00-03:00", "therapist_id": 10}
63	2026-04-04 07:51:20.618609-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	{"starts_at": "2026-04-16 10:00:00-03:00", "therapist_id": 10}
64	2026-04-04 07:58:06.093618-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	{"starts_at": "2026-04-21 07:00:00-03:00", "therapist_id": 10}
65	2026-04-04 08:05:35.858272-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	{"starts_at": "2026-04-21 08:00:00-03:00", "therapist_id": 10}
66	2026-04-04 08:12:30.25122-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	{"starts_at": "2026-04-21 07:00:00-03:00", "therapist_id": 10}
67	2026-04-04 08:28:41.30953-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	{"starts_at": "2026-04-21 08:00:00-03:00", "therapist_id": 10}
68	2026-04-04 11:53:29.679154-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	{"starts_at": "2026-04-16 10:00:00-03:00", "therapist_id": 10}
69	2026-04-04 12:53:44.172008-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	{"starts_at": "2026-04-21 09:00:00-03:00", "therapist_id": 10}
70	2026-04-04 13:11:09.773445-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	{"starts_at": "2026-04-21 10:00:00-03:00", "therapist_id": 10}
71	2026-04-04 13:25:36.862798-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	{"starts_at": "2026-04-23 07:00:00-03:00", "therapist_id": 10}
72	2026-04-05 12:25:41.882019-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	{"starts_at": "2026-04-07 10:00:00-03:00", "therapist_id": 10}
73	2026-04-05 12:51:30.13174-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	{"starts_at": "2026-04-09 07:00:00-03:00", "therapist_id": 10}
74	2026-04-05 17:43:00.263336-03	110	patient	insufficient_balance_attempt	100.0	200.0	\N	3	103	\N	Tentativa de agendamento com saldo insuficiente: necess├írio R$ 200.00, dispon├¡vel R$ 100.00	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	{"starts_at": "2026-04-16 08:00:00-03:00", "therapist_id": 10}
\.


--
-- Data for Name: availability_periods; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.availability_periods (id, therapist_profile_id, start_date, end_date, created_at, updated_at) FROM stdin;
5	3	2026-03-01	2026-03-31	2026-03-22 20:34:52.806064-03	\N
6	3	2026-04-01	2026-04-30	2026-03-22 20:35:31.16223-03	\N
7	3	2026-04-01	2026-04-30	2026-03-27 18:20:25.533073-03	\N
9	3	2026-03-27	2026-03-28	2026-03-27 22:19:17.159982-03	\N
10	3	2026-05-01	2026-05-30	2026-03-30 21:03:21.029545-03	\N
11	\N	2026-03-30	2026-05-31	2026-03-30 22:46:37.74307-03	\N
\.


--
-- Data for Name: availability_slots; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.availability_slots (id, period_id, weekday, start_time, end_time, created_at, updated_at) FROM stdin;
28	5	0	07:00:00	08:00:00	2026-03-22 20:34:52.806064-03	\N
29	5	0	08:00:00	09:00:00	2026-03-22 20:34:52.806064-03	\N
30	5	0	09:00:00	10:00:00	2026-03-22 20:34:52.806064-03	\N
31	5	0	10:00:00	11:00:00	2026-03-22 20:34:52.806064-03	\N
32	5	2	07:00:00	08:00:00	2026-03-22 20:34:52.806064-03	\N
33	5	2	08:00:00	09:00:00	2026-03-22 20:34:52.806064-03	\N
34	5	2	09:00:00	10:00:00	2026-03-22 20:34:52.806064-03	\N
35	5	2	10:00:00	11:00:00	2026-03-22 20:34:52.806064-03	\N
36	5	4	07:00:00	08:00:00	2026-03-22 20:34:52.806064-03	\N
37	5	4	08:00:00	09:00:00	2026-03-22 20:34:52.806064-03	\N
38	5	4	09:00:00	10:00:00	2026-03-22 20:34:52.806064-03	\N
39	5	4	10:00:00	11:00:00	2026-03-22 20:34:52.806064-03	\N
40	6	1	07:00:00	08:00:00	2026-03-22 20:35:31.16223-03	\N
41	6	1	08:00:00	09:00:00	2026-03-22 20:35:31.16223-03	\N
42	6	1	09:00:00	10:00:00	2026-03-22 20:35:31.16223-03	\N
43	6	1	10:00:00	11:00:00	2026-03-22 20:35:31.16223-03	\N
44	6	3	07:00:00	08:00:00	2026-03-22 20:35:31.16223-03	\N
45	6	3	08:00:00	09:00:00	2026-03-22 20:35:31.16223-03	\N
46	6	3	09:00:00	10:00:00	2026-03-22 20:35:31.16223-03	\N
47	6	3	10:00:00	11:00:00	2026-03-22 20:35:31.16223-03	\N
48	7	0	09:00:00	10:00:00	2026-03-27 18:20:25.533073-03	\N
50	9	5	09:00:00	11:00:00	2026-03-27 22:19:17.159982-03	\N
51	10	0	07:00:00	08:00:00	2026-03-30 21:03:21.029545-03	\N
52	10	0	08:00:00	09:00:00	2026-03-30 21:03:21.029545-03	\N
53	10	0	09:00:00	10:00:00	2026-03-30 21:03:21.029545-03	\N
54	10	0	10:00:00	11:00:00	2026-03-30 21:03:21.029545-03	\N
55	10	1	07:00:00	08:00:00	2026-03-30 21:03:21.029545-03	\N
56	10	1	08:00:00	09:00:00	2026-03-30 21:03:21.029545-03	\N
57	10	1	09:00:00	10:00:00	2026-03-30 21:03:21.029545-03	\N
58	10	1	10:00:00	11:00:00	2026-03-30 21:03:21.029545-03	\N
\.


--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_messages (id, thread_id, sender_id, message, is_read, read_at, created_at) FROM stdin;
1	1	10	Oi Anna, \nvai conseguir entrar na nossa sess├úo hoje?	t	2026-04-02 12:27:59.841937-03	2026-04-02 12:27:38.859691-03
2	1	110	Vou sim Dr. um minutinho por favor	t	2026-04-02 12:28:20.093483-03	2026-04-02 12:28:16.878747-03
3	1	110	Consegue entrar agora?	t	2026-04-03 15:10:55.777963-03	2026-04-02 13:32:13.46582-03
5	5	6	Boa tarde Dr. Alexandre!	t	2026-04-03 18:56:48.29537-03	2026-04-03 18:40:29.219281-03
6	5	6	est├í por ai?	t	2026-04-03 18:56:48.295401-03	2026-04-03 18:47:29.555194-03
7	5	6	oi	t	2026-04-03 18:56:48.295415-03	2026-04-03 18:56:00.736134-03
8	5	10	Boa noite Dr. Sigmund!\nComo posso ajudar?	t	2026-04-03 19:04:28.287597-03	2026-04-03 19:02:21.030685-03
9	5	6	Para tirar um d├║vida simples...	t	2026-04-04 09:59:29.121787-03	2026-04-03 19:05:34.67118-03
10	5	10	claro me diga, o que seria	f	\N	2026-04-04 09:59:40.667038-03
4	1	10	Sim, deu super certo agora	t	2026-04-05 17:42:20.281863-03	2026-04-03 15:11:05.581897-03
11	1	110	era um probleminha t├®cnico	t	2026-04-06 11:20:52.533775-03	2026-04-05 17:42:38.301559-03
12	1	10	Bom dia Dr. Alexandre!	t	2026-04-06 11:51:37.859931-03	2026-04-06 11:21:02.513196-03
13	1	10	Bom dia Anna!	t	2026-04-06 11:51:37.859948-03	2026-04-06 11:26:59.328034-03
14	1	10	t├í por ai?	t	2026-04-06 11:51:37.85996-03	2026-04-06 11:51:24.735007-03
15	1	110	estou sim, desculpa a demora	t	2026-04-06 11:54:42.872943-03	2026-04-06 11:54:42.814675-03
16	1	110	pode falar um minutinho?	t	2026-04-06 16:12:31.296026-03	2026-04-06 11:54:56.962811-03
17	1	10	agora estou em atendimento, podemos conversar durante a nossa sess├úo?	f	\N	2026-04-06 16:12:50.894723-03
\.


--
-- Data for Name: chat_threads; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_threads (id, patient_id, therapist_id, last_message_at, created_at, therapist_user_id, patient_user_id, updated_at) FROM stdin;
5	\N	\N	2026-04-04 09:59:40.674297-03	2026-04-03 18:40:19.027363-03	10	6	2026-04-04 09:59:40.674351-03
1	103	3	2026-04-06 16:12:50.932408-03	2026-04-02 11:33:29.607707-03	10	110	2026-04-06 16:12:50.930799-03
\.


--
-- Data for Name: commissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.commissions (id, appointment_id, therapist_id, session_price, commission_rate, commission_amount, net_amount, is_refund, created_at, updated_at) FROM stdin;
6	42	3	200.00	20.00	40.00	160.00	f	2026-04-09 09:00:00	2026-04-04 17:52:55.592878
7	45	3	200.00	20.00	40.00	160.00	f	2026-04-02 07:00:00	2026-04-04 17:52:55.592878
8	49	3	200.00	20.00	40.00	160.00	f	2026-04-02 09:00:00	2026-04-04 17:52:55.592878
9	48	3	200.00	20.00	40.00	160.00	f	2026-04-02 08:00:00	2026-04-04 17:52:55.592878
10	8	3	200.00	20.00	40.00	160.00	f	2026-04-02 14:00:00	2026-04-04 17:52:55.592878
\.


--
-- Data for Name: goal_types; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.goal_types (id, name, description, icon, is_active) FROM stdin;
2	Ansiedade	Gerenciar e reduzir sintomas de ansiedade	\N	t
3	Relacionamentos	Melhorar relacionamentos interpessoais	\N	t
5	Luto	Processamento de perdas	\N	t
1	TOC	Gerenciar sintomas do Transtorno Obsessivo-Compulsivo	\N	t
4	Carreira	Elaborar estresse laboral e assuntos profissionais e de carreira	\N	t
6	Autoestima	Fortalecer e elaborar a autoestima	\N	t
\.


--
-- Data for Name: ledger; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ledger (id, wallet_id, appointment_id, transaction_type, amount, balance_after, description, metadata, created_at) FROM stdin;
1	102	\N	credit_purchase	100.00	400.00	Recarga via Stripe	{"payment_id": 1}	2026-03-22 12:28:53.935716-03
2	102	\N	credit_purchase	100.00	500.00	Recarga via Stripe	{"payment_id": 2}	2026-03-22 12:32:10.408665-03
3	102	\N	credit_purchase	100.00	600.00	Recarga via Stripe	{"payment_id": 3}	2026-03-22 12:41:40.434084-03
4	102	7	session_debit	200.00	400.00	Sess├úo com terapeuta ID 10	\N	2026-03-22 12:59:04.789734-03
5	102	8	session_debit	200.00	200.00	Sess├úo com terapeuta ID 10	\N	2026-03-22 17:12:25.275568-03
6	102	9	session_debit	200.00	0.00	Sess├úo com terapeuta ID 10	\N	2026-03-22 17:12:56.829919-03
7	102	\N	credit_purchase	200.00	200.00	Recarga via Stripe	{"payment_id": 4}	2026-03-22 18:04:02.083917-03
8	102	11	session_debit	200.00	0.00	Sess├úo 11	\N	2026-03-22 18:04:02.083917-03
9	102	\N	credit_purchase	200.00	200.00	Recarga via Stripe	{"payment_id": 5}	2026-03-22 21:43:53.213598-03
10	102	16	session_debit	200.00	0.00	Sess├úo 16	\N	2026-03-22 21:43:53.213598-03
11	102	\N	credit_purchase	200.00	200.00	Recarga via Stripe	{"payment_id": 7}	2026-03-23 10:57:55.483873-03
12	102	20	session_debit	200.00	0.00	Sess├úo 20	\N	2026-03-23 10:57:55.483873-03
13	102	\N	credit_purchase	200.00	200.00	Recarga via Stripe	{"payment_id": 8}	2026-03-23 11:01:23.403315-03
14	102	21	session_debit	200.00	0.00	Sess├úo 21	\N	2026-03-23 11:01:23.403315-03
15	102	\N	credit_purchase	200.00	200.00	Recarga via Stripe	{"payment_id": 9}	2026-03-23 12:04:25.178862-03
16	102	22	session_debit	200.00	0.00	Sess├úo 22	\N	2026-03-23 12:04:25.178862-03
17	102	\N	credit_purchase	200.00	200.00	Recarga via Stripe	{"payment_id": 10}	2026-03-23 16:12:58.919327-03
18	102	25	session_debit	200.00	0.00	Sess├úo 25	\N	2026-03-23 16:12:58.919327-03
19	102	25	cancellation_refund	200.00	200.00	Estorno por cancelamento - Sess├úo 25	\N	2026-03-23 18:51:42.022284-03
20	102	21	cancellation_refund	200.00	400.00	Estorno por cancelamento (terapeuta) - Sess├úo 21	\N	2026-03-23 18:53:53.876514-03
21	102	26	session_debit	200.00	200.00	Sess├úo com terapeuta ID 10	\N	2026-03-23 19:16:56.489179-03
22	102	27	session_debit	200.00	0.00	Sess├úo com terapeuta ID 10	\N	2026-03-23 19:17:21.72793-03
23	102	27	cancellation_refund	200.00	200.00	Estorno por cancelamento - Sess├úo 27	\N	2026-03-23 19:24:44.267269-03
24	102	28	session_debit	200.00	0.00	Sess├úo com terapeuta ID 10	\N	2026-03-23 19:33:52.627192-03
25	102	28	cancellation_refund	200.00	200.00	Estorno por cancelamento - Sess├úo 28	\N	2026-03-23 19:34:23.397144-03
26	102	29	session_debit	200.00	0.00	Sess├úo com terapeuta ID 10	\N	2026-03-23 19:40:38.359196-03
27	102	29	cancellation_refund	200.00	200.00	Estorno por cancelamento - Sess├úo 29	\N	2026-03-23 19:41:09.098296-03
28	102	30	session_debit	200.00	0.00	Sess├úo com terapeuta ID 10	\N	2026-03-23 19:46:39.473123-03
29	102	30	cancellation_refund	200.00	200.00	Estorno por cancelamento - Sess├úo 30	\N	2026-03-23 19:47:07.812827-03
30	102	31	session_debit	200.00	0.00	Sess├úo com terapeuta ID 10	\N	2026-03-23 19:49:56.796373-03
31	102	31	cancellation_refund	200.00	200.00	Estorno por cancelamento - Sess├úo 31	\N	2026-03-23 19:50:12.335873-03
32	102	32	session_debit	200.00	0.00	Sess├úo com terapeuta ID 10	\N	2026-03-23 21:03:17.980787-03
33	102	\N	credit_purchase	200.00	200.00	Recarga via Stripe	{"payment_id": 11}	2026-03-23 21:05:55.391956-03
34	102	33	session_debit	200.00	0.00	Sess├úo 33	\N	2026-03-23 21:05:55.391956-03
35	102	33	cancellation_refund	200.00	200.00	Estorno por cancelamento - Sess├úo 33	\N	2026-03-23 21:12:30.48908-03
36	102	34	session_debit	200.00	0.00	Sess├úo com terapeuta ID 10	\N	2026-03-23 21:20:32.425243-03
37	102	34	cancellation_refund	200.00	200.00	Estorno por cancelamento - Sess├úo 34	\N	2026-03-23 21:26:44.140364-03
38	102	35	session_debit	200.00	0.00	Sess├úo com terapeuta ID 10	\N	2026-03-25 23:02:55.26412-03
39	102	26	cancellation_refund	200.00	200.00	Estorno por cancelamento - Sess├úo 26	\N	2026-03-26 13:49:23.881478-03
40	102	36	session_debit	200.00	0.00	Sess├úo com terapeuta ID 10	\N	2026-03-26 13:49:55.285383-03
41	102	\N	credit_purchase	200.00	200.00	Recarga via Stripe	{"payment_id": 12}	2026-03-27 23:28:08.43038-03
42	102	39	session_debit	200.00	0.00	Sess├úo com terapeuta ID 10	\N	2026-03-27 23:29:34.956906-03
43	102	\N	credit_purchase	500.00	500.00	Recarga via Stripe	{"payment_id": 13}	2026-03-27 23:32:38.108805-03
44	102	39	cancellation_refund	200.00	700.00	Estorno por cancelamento - Sess├úo 39	\N	2026-03-27 23:33:05.699884-03
45	102	40	session_debit	200.00	500.00	Sess├úo com terapeuta ID 10	\N	2026-03-27 23:33:58.306625-03
46	102	40	cancellation_refund	200.00	700.00	Estorno por cancelamento - Sess├úo 40	\N	2026-03-27 23:36:38.609674-03
47	102	36	cancellation_refund	200.00	900.00	Estorno por cancelamento (terapeuta) - Sess├úo 36	\N	2026-03-28 22:51:07.616686-03
48	102	17	session_debit	200.00	700.00	Sess├úo com terapeuta ID 10	\N	2026-03-29 23:01:59.833983-03
49	102	41	session_debit	200.00	500.00	Sess├úo com terapeuta ID 10	\N	2026-03-30 14:40:32.676721-03
50	102	42	session_debit	200.00	300.00	Sess├úo com terapeuta ID 10	\N	2026-03-30 14:40:46.173448-03
51	102	43	session_debit	200.00	100.00	Sess├úo com terapeuta ID 10	\N	2026-03-30 19:31:12.951121-03
52	102	\N	credit_purchase	200.00	300.00	Recarga via Stripe	{"payment_id": 14}	2026-03-30 19:33:14.302598-03
53	102	44	session_debit	200.00	100.00	Sess├úo 44	\N	2026-03-30 19:33:14.302598-03
54	102	\N	credit_purchase	200.00	300.00	Recarga via Stripe	{"payment_id": 15}	2026-03-31 21:59:49.791068-03
55	102	45	session_debit	200.00	100.00	Sess├úo 45	\N	2026-03-31 21:59:49.791068-03
56	102	\N	credit_purchase	200.00	300.00	Recarga via Stripe	{"payment_id": 16}	2026-04-01 09:58:12.89988-03
57	102	47	session_debit	200.00	100.00	Sess├úo 47	\N	2026-04-01 09:58:12.89988-03
58	102	\N	credit_purchase	200.00	300.00	Recarga via Stripe	{"payment_id": 17}	2026-04-01 14:57:00.579494-03
59	102	48	session_debit	200.00	100.00	Sess├úo 48	\N	2026-04-01 14:57:00.579494-03
60	102	\N	credit_purchase	200.00	300.00	Recarga via Stripe	{"payment_id": 18}	2026-04-01 15:54:06.469887-03
61	102	49	session_debit	200.00	100.00	Sess├úo 49	\N	2026-04-01 15:54:06.469887-03
62	102	\N	credit_purchase	200.00	300.00	Recarga via Stripe	{"payment_id": 20}	2026-04-01 15:56:15.332836-03
63	102	51	session_debit	200.00	100.00	Sess├úo 51	\N	2026-04-01 15:56:15.332836-03
64	102	\N	credit_purchase	200.00	300.00	Recarga via Stripe	{"payment_id": 21}	2026-04-01 15:57:38.081192-03
65	102	52	session_debit	200.00	100.00	Sess├úo 52	\N	2026-04-01 15:57:38.081192-03
66	102	52	cancellation_refund	200.00	300.00	Estorno por cancelamento - Sess├úo 52	\N	2026-04-01 15:58:59.205054-03
67	102	53	session_debit	200.00	100.00	Sess├úo com terapeuta ID 10	\N	2026-04-01 15:59:12.170005-03
68	102	\N	credit_purchase	200.00	300.00	Recarga via Stripe	{"payment_id": 22}	2026-04-01 17:11:53.503461-03
69	102	54	session_debit	200.00	100.00	Sess├úo 54	\N	2026-04-01 17:11:53.503461-03
70	102	\N	credit_purchase	200.00	300.00	Recarga via Stripe	{"payment_id": 23}	2026-04-01 17:51:00.559585-03
71	102	55	session_debit	200.00	100.00	Sess├úo 55	\N	2026-04-01 17:51:00.559585-03
72	102	\N	credit_purchase	200.00	300.00	Recarga via Stripe	{"payment_id": 24}	2026-04-01 18:06:58.589917-03
73	102	56	session_debit	200.00	100.00	Sess├úo 56	\N	2026-04-01 18:06:58.589917-03
74	102	\N	credit_purchase	200.00	300.00	Recarga via Stripe	{"payment_id": 35}	2026-04-04 13:25:59.972975-03
75	102	79	session_debit	200.00	100.00	Sess├úo 79 - Pagamento confirmado	\N	2026-04-04 13:25:59.972975-03
76	102	\N	credit_purchase	200.00	300.00	Recarga via Stripe	{"payment_id": 36}	2026-04-05 12:26:13.1221-03
77	102	80	session_debit	200.00	100.00	Sess├úo 80 - Pagamento confirmado	\N	2026-04-05 12:26:13.1221-03
78	102	\N	credit_purchase	200.00	300.00	Recarga via Stripe	{"payment_id": 37}	2026-04-05 12:51:56.08784-03
79	102	81	session_debit	200.00	100.00	Sess├úo 81 - Pagamento confirmado	\N	2026-04-05 12:51:56.08784-03
80	102	\N	credit_purchase	200.00	300.00	Recarga via Stripe	{"payment_id": 38}	2026-04-05 17:43:32.235387-03
81	102	82	session_debit	200.00	100.00	Sess├úo 82 - Pagamento confirmado	\N	2026-04-05 17:43:32.235387-03
\.


--
-- Data for Name: medical_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.medical_records (id, appointment_id, session_not_occurred, not_occurred_reason, evolution, outcome, patient_reasons, activity_instructions, links, private_notes, created_at, updated_at, ai_draft) FROM stdin;
1	35	f	\N	\N	\N	["Tenho me sentido muito ansioso com o projeto!\\nEstou precisando de ajuda para lidar com a ansiedade"]	\N	\N	\N	2026-03-30 07:45:49.935424	2026-03-30 08:21:40.4603	\N
2	17	f	\N	\N	\N	["Tenho me sentido muito ansioso com o projeto!\\nEstou precisando de ajuda para lidar com a ansiedade"]	\N	\N	\N	2026-03-30 14:39:06.522993	\N	\N
4	42	f		Paciente anda muito estressado e ansioso com o trabalho.	EM_ACOMPANHAMENTO	["ansiedade", "estresse"]	Se ame mais!	["https://youtu.be/ThSrK-C46OM?si=FO2MfB2EArsLNvAQ"]	Nada em particular	2026-03-31 15:11:46.059671	\N	\N
5	55	f	\N	\N	\N	["Ando muito cansado e estressado com o trabalho."]	\N	\N	\N	2026-04-01 19:11:38.347201	2026-04-01 19:37:53.788555	\N
6	54	f	\N	\N	\N	["Ando muito cansado e estressado com o trabalho."]	\N	\N	\N	2026-04-01 19:46:16.487041	\N	\N
7	45	t	CLIENTE_NAO_COMPARECEU	\N	\N	[]	\N	null		2026-04-02 14:09:23.684343	\N	\N
8	47	f	\N	\N	\N	\N	\N	\N	\N	2026-04-03 13:50:56.567075	\N	**Demanda:**  Estou registrando que a paciente n├úo apareceu na sess├úo e que eu vou marcar a sess├úo como n├úo ocorreu porque a paciente n├úo apareceu.\n\n**Interven├º├úo:** Foram realizadas t├®cnicas de escuta ativa e acolhimento. Paciente apresentou-se receptivo ao processo terap├¬utico.\n\n**Impress├úo:** Paciente demonstrou insight sobre suas dificuldades. Discutiu-se estrat├®gias de enfrentamento.\n\n**Encaminhamento:** Manter acompanhamento semanal. Sugerida pr├ítica de exerc├¡cios de regula├º├úo emocional entre sess├Áes.\n\n---\n*­ƒôØ Rascunho gerado automaticamente por IA. Revise e ajuste conforme necess├írio.*
9	8	t	CLIENTE_NAO_COMPARECEU	\N	\N	[]	\N	null		2026-04-03 13:52:42.201812	\N	\N
10	49	t	CLIENTE_NAO_COMPARECEU	\N	\N	[]	\N	null		2026-04-03 13:53:07.257254	\N	\N
11	48	t	CLIENTE_NAO_COMPARECEU	\N	\N	[]	\N	null		2026-04-03 13:53:24.051171	\N	\N
12	16	t	CLIENTE_NAO_COMPARECEU	\N	\N	[]	\N	null		2026-04-06 15:07:05.727381	\N	\N
13	32	t	CLIENTE_NAO_COMPARECEU	\N	\N	[]	\N	null		2026-04-08 15:32:34.405729	\N	\N
14	80	t	CLIENTE_NAO_COMPARECEU	\N	\N	[]	\N	null		2026-04-08 15:33:17.890152	\N	\N
15	43	f	CLIENTE_NAO_COMPARECEU	Paciente relata fortes crises de ansiedade e ang├║stia	EM_ACOMPANHAMENTO	["ansiedade", "burnout", "estresse"]		[]		2026-04-08 15:34:19.036156	\N	\N
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, type, title, message, data, action_link, is_read, created_at) FROM stdin;
1	110	appointment_confirmed	Ô£à Sess├úo confirmada	Sua sess├úo com Alexandre Alonso foi confirmada para 16/04/2026 ├ás 08:00	{"meet_url": "https://meet.google.com/jmh-oeuq-otc", "appointment_id": 82, "therapist_name": "Alexandre Alonso"}	/patient/schedule	f	2026-04-05 20:43:38.682204-03
2	10	appointment_confirmed	Ô£à Sess├úo confirmada	Anna Freud confirmou a sess├úo em 16/04/2026 ├ás 08:00	{"meet_url": "https://meet.google.com/jmh-oeuq-otc", "patient_name": "Anna Freud", "appointment_id": 82}	/therapist/schedule	f	2026-04-05 20:43:38.716821-03
3	10	document_validation	Documento aprovado: Diploma	Seu documento Diploma foi aprovado!	null	/therapist/documents	f	2026-04-06 13:53:49.834007-03
4	10	document_validation	Documento aprovado: Registro Profissional	Seu documento Registro Profissional foi aprovado!	null	/therapist/documents	f	2026-04-06 13:57:29.831542-03
5	110	new_chat_message	Nova mensagem	Alexandre Alonso enviou uma mensagem: Bom dia Anna!...	{"sender_id": 10, "thread_id": 1, "sender_name": "Alexandre Alonso", "message_preview": "Bom dia Anna!"}	/chat?thread=1	f	2026-04-06 14:26:59.345083-03
6	110	new_chat_message	Nova mensagem	Alexandre Alonso enviou uma mensagem: t├í por ai?...	{"sender_id": 10, "thread_id": 1, "sender_name": "Alexandre Alonso", "message_preview": "t├í por ai?"}	/chat?thread=1	f	2026-04-06 14:51:24.759426-03
7	10	new_chat_message	Nova mensagem	Anna Freud enviou uma mensagem: estou sim, desculpa a demora...	{"sender_id": 110, "thread_id": 1, "sender_name": "Anna Freud", "message_preview": "estou sim, desculpa a demora"}	/chat?thread=1	f	2026-04-06 14:54:42.827839-03
8	10	new_chat_message	Nova mensagem	Anna Freud enviou uma mensagem: pode falar um minutinho?...	{"sender_id": 110, "thread_id": 1, "sender_name": "Anna Freud", "message_preview": "pode falar um minutinho?"}	/chat?thread=1	f	2026-04-06 14:54:56.975334-03
9	110	appointment_rescheduled	Sess├úo reagendada	Sua sess├úo com Alexandre Alonso foi reagendada para 16/04/2026 ├ás 09:00	{"meet_url": null, "appointment_id": 83, "therapist_name": "Alexandre Alonso"}	/patient/schedule	f	2026-04-06 18:07:42.216007-03
10	10	appointment_rescheduled	Sess├úo reagendada	Sess├úo com Anna Freud foi reagendada para 16/04/2026 ├ás 09:00	{"meet_url": null, "patient_name": "Anna Freud", "appointment_id": 83}	/therapist/schedule	f	2026-04-06 18:07:42.234571-03
11	110	appointment_confirmed	Sess├úo agendada	Sua sess├úo com Alexandre Alonso foi confirmada para 16/04/2026 ├ás 09:00	{"meet_url": "https://meet.google.com/mtq-baxf-qhf", "appointment_id": 83, "therapist_name": "Alexandre Alonso"}	/patient/schedule	f	2026-04-06 18:07:50.404415-03
12	10	appointment_confirmed	Sess├úo agendada	Anna Freud agendou uma nova sess├úo para 16/04/2026 ├ás 09:00	{"meet_url": "https://meet.google.com/mtq-baxf-qhf", "patient_name": "Anna Freud", "appointment_id": 83}	/therapist/schedule	f	2026-04-06 18:07:50.418053-03
13	110	new_chat_message	Nova mensagem	Alexandre Alonso enviou uma mensagem: agora estou em atendimento, podemos conversar dura...	{"sender_id": 10, "thread_id": 1, "sender_name": "Alexandre Alonso", "message_preview": "agora estou em atendimento, podemos conversar dura"}	/chat?thread=1	f	2026-04-06 19:12:50.973297-03
\.


--
-- Data for Name: patient_addresses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.patient_addresses (id, patient_id, street, number, complement, city, state, zipcode, country, is_default, created_at, neighborhood, address_type) FROM stdin;
4	103	Rua Jesus Machado Gontijo			Belo Horizonte	MG	31340-010	Brasil	t	2026-03-30 18:42:33.758895-03	Ouro Preto	residential
\.


--
-- Data for Name: patient_billing; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.patient_billing (id, patient_id, payment_method, billing_address_id, tax_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: patient_favorites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.patient_favorites (id, patient_id, therapist_id, created_at) FROM stdin;
\.


--
-- Data for Name: patient_goals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.patient_goals (id, patient_id, goal_type, is_active, selected_at, completed_at, notes, target_date, created_at) FROM stdin;
1	35	autoconhecimento	t	2026-03-16 11:53:33.402763-03	\N	\N	\N	2026-03-18
2	35	carreira	t	2026-03-18 15:59:44.028604-03	\N	\N	\N	2026-03-18
3	103	autoconhecimento	t	2026-03-18 16:58:31.054135-03	\N	\N	\N	2026-03-18
4	103	ansiedade	t	2026-03-30 08:21:35.244694-03	\N	\N	\N	2026-03-30
5	103	depressao	t	2026-03-30 14:39:04.911329-03	\N	\N	\N	2026-03-30
\.


--
-- Data for Name: patient_profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.patient_profiles (id, user_id, full_name, email, phone, cpf, timezone, preferred_language, created_at, updated_at, foto_url, therapy_goals, birth_date, education_level) FROM stdin;
103	110	Anna Freud	patient92@test.com	(31)983354457	044.538.286-40	America/Sao_Paulo	pt-BR	2026-03-16 07:01:37.412347-03	2026-03-30 18:18:37.924497-03	/uploads/patients/patient_110_b467030b70ea435fa9618e6dd3d5cda2.jpg	[]	1981-11-13	Doutorado
35	18	Donald Winnicott	patient0@test.com	(31) 98694-2939		America/Sao_Paulo	pt-BR	2026-03-16 07:01:37.412347-03	2026-03-18 15:59:56.455996-03	/uploads/patients/patient_18_7dbff36a0e034e97a10303d20315f7ce.jpg	[]	\N	\N
\.


--
-- Data for Name: patient_security; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.patient_security (id, patient_id, password_hash, recovery_email, two_factor_enabled, last_login, created_at) FROM stdin;
\.


--
-- Data for Name: patient_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.patient_sessions (id, patient_id, therapist_id, appointment_id, session_date, start_time, end_time, duration_minutes, therapist_name, therapist_specialty, status, session_price, video_call_url, recording_url, session_notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: patient_statistics; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.patient_statistics (id, patient_id, total_sessions, sessions_completed, sessions_cancelled, sessions_missed, sessions_rescheduled, sessions_last_7_days, sessions_last_30_days, sessions_last_90_days, last_session_date, next_session_date, total_with_therapist, favorite_therapist_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: patient_subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.patient_subscriptions (id, patient_id, plan_id, status, start_date, end_date, benefit_type, coupon_id, auto_renew, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payments (id, patient_id, wallet_id, stripe_payment_intent_id, amount, currency, status, payment_method, description, metadata, created_at, paid_at, refunded_at, stripe_session_id, appointment_id) FROM stdin;
1	103	102	\N	100.00	BRL	paid	stripe	\N	\N	2026-03-22 12:28:26.360093-03	2026-03-22 12:28:53.941085-03	\N	\N	\N
2	103	102	\N	100.00	BRL	paid	stripe	\N	\N	2026-03-22 12:31:45.257515-03	2026-03-22 12:32:10.410036-03	\N	\N	\N
38	103	102	\N	200.00	BRL	paid	\N	Pagamento sess├úo #82	\N	2026-04-05 17:43:00.403287-03	2026-04-05 17:43:32.239121-03	\N	cs_test_a1BP94du43uCVS8qM6lXsQSDDAsgdwmkTnpYALCCqdAJVlRPGUE79HnUUX	82
3	103	102	\N	100.00	BRL	paid	stripe	\N	\N	2026-03-22 12:41:16.897036-03	2026-03-22 12:41:40.435393-03	\N	\N	\N
4	103	102	\N	200.00	BRL	paid	\N	Pagamento sess├úo #11	\N	2026-03-22 18:03:27.974179-03	2026-03-22 18:04:02.093712-03	\N	cs_test_a1hG7UZiA8w4zohfjtGS9Rm2o2fzMmeGCXweB29mGzJ8HCiNybsY41r2Mo	11
5	103	102	\N	200.00	BRL	paid	\N	Pagamento sess├úo #16	\N	2026-03-22 21:43:26.113849-03	2026-03-22 21:43:53.220451-03	\N	cs_test_a1OVvYkeZXdmg8abCB6dBv9z5qLPX25b7nddzYbfUAxytc3ydMzyhLUxwf	16
6	103	102	\N	200.00	BRL	pending	\N	Pagamento sess├úo #19	\N	2026-03-23 10:31:27.914001-03	\N	\N	cs_test_a1dM8lkse7oNwtH6pQFn7f39bn1TQnNhUSwrzMxXsvIrYsTWcO9PsWGM1t	19
7	103	102	\N	200.00	BRL	paid	\N	Pagamento sess├úo #20	\N	2026-03-23 10:57:30.210605-03	2026-03-23 10:57:55.495261-03	\N	cs_test_a16Q3bEMqTKI7BxbTYOPHLfL7eCL53p1bsF7ShaQclcOnPWlnldbI6GDd3	20
8	103	102	\N	200.00	BRL	paid	\N	Pagamento sess├úo #21	\N	2026-03-23 11:00:56.82409-03	2026-03-23 11:01:23.404644-03	\N	cs_test_a18XgzPGuzITUAnGi7h2uXrXHgeiASNUpOWRSYNGint8RDPhLiEcNeaowR	21
9	103	102	\N	200.00	BRL	paid	\N	Pagamento sess├úo #22	\N	2026-03-23 12:03:55.714304-03	2026-03-23 12:04:25.182605-03	\N	cs_test_a17Kih3iD1rEPkEZeutUFS5q6PU5nLZNxcvApFVMvXgnSWJlbsRij7NvQK	22
10	103	102	\N	200.00	BRL	paid	\N	Pagamento sess├úo #25	\N	2026-03-23 16:12:30.200952-03	2026-03-23 16:12:58.929202-03	\N	cs_test_a1rq8GIGoR19fHy2YeW2NRPf0CMrPY7TO9dCxkhvPROgWCtaSxCYF2wfpd	25
11	103	102	\N	200.00	BRL	paid	\N	Pagamento sess├úo #33	\N	2026-03-23 21:03:31.891933-03	2026-03-23 21:05:55.398629-03	\N	cs_test_a1iPnsvLj5ILD5OMYPB0aIqhHfRYGZrfYF0TYr9lkJ8XGDYiHQl69igrdE	33
12	103	102	\N	200.00	BRL	paid	stripe	\N	\N	2026-03-27 23:27:39.618388-03	2026-03-27 23:28:08.442361-03	\N	\N	\N
13	103	102	\N	500.00	BRL	paid	stripe	\N	\N	2026-03-27 23:32:10.173387-03	2026-03-27 23:32:38.114639-03	\N	\N	\N
14	103	102	\N	200.00	BRL	paid	\N	Pagamento sess├úo #44	\N	2026-03-30 19:32:39.384216-03	2026-03-30 19:33:14.31046-03	\N	cs_test_a14hVsQ1QdGduBm5VS0c1KKkML99efFqi5VzWI0XiehvM1gMayJTwpktgK	44
15	103	102	\N	200.00	BRL	paid	\N	Pagamento sess├úo #45	\N	2026-03-31 21:59:06.724715-03	2026-03-31 21:59:49.880261-03	\N	cs_test_a1QcWfQrcXW2ZUicpZxObynNADIIGK05arpGZh4fBa8fsoK6LwNomwPfIs	45
16	103	102	\N	200.00	BRL	paid	\N	Pagamento sess├úo #47	\N	2026-04-01 09:51:23.028115-03	2026-04-01 09:58:12.904963-03	\N	cs_test_a1fdVJc9O8v7w7sHbDAIDIuULagQMBJsut3WkzYdIhNGJkVBQkkKG0NXfS	47
17	103	102	\N	200.00	BRL	paid	\N	Pagamento sess├úo #48	\N	2026-04-01 14:56:16.104433-03	2026-04-01 14:57:00.587019-03	\N	cs_test_a14ZMhUZqpYcBbRTN22RcA6uqsTfEXfEhaIC2imjSmNj70i4L5bjZtak37	48
18	103	102	\N	200.00	BRL	paid	\N	Pagamento sess├úo #49	\N	2026-04-01 15:53:39.941296-03	2026-04-01 15:54:06.479852-03	\N	cs_test_a1QfH1qdOrqrxHPps6Uds2RnzKWpRexqUGuNoLrk4DFWGU8Es1WaKTo4lK	49
19	103	102	\N	200.00	BRL	pending	\N	Pagamento sess├úo #50	\N	2026-04-01 15:55:31.33939-03	\N	\N	cs_test_a1JUnb3mBJOFH8QZlUnd5Dat5rkkYII4Fcr9lq8TKqdi2gpqbG3iszYH8h	50
20	103	102	\N	200.00	BRL	paid	\N	Pagamento sess├úo #51	\N	2026-04-01 15:55:50.83128-03	2026-04-01 15:56:15.340325-03	\N	cs_test_a1OUArFmEjHvSgexiYguSKwCEW3zTH6nFFx1mXahEvWoZ2T6PyYaIjqtJB	51
21	103	102	\N	200.00	BRL	paid	\N	Pagamento sess├úo #52	\N	2026-04-01 15:57:06.021777-03	2026-04-01 15:57:38.082906-03	\N	cs_test_a1yQaXvUp8bZmNgeXfU1onccaO9zqmZ0gPZWb8odiHCTyKMcv8ygn6gJbP	52
22	103	102	\N	200.00	BRL	paid	\N	Pagamento sess├úo #54	\N	2026-04-01 17:11:20.078876-03	2026-04-01 17:11:53.511356-03	\N	cs_test_a1WjhbM1RRI4isNwHPwxUUUTnod7nG3vD1pPahVIJ71a3cv7TRcUQf5zUI	54
23	103	102	\N	200.00	BRL	paid	\N	Pagamento sess├úo #55	\N	2026-04-01 17:50:31.849893-03	2026-04-01 17:51:00.567578-03	\N	cs_test_a16tZdDhFl60A1VD4SB1aoUiBdLHH2zRTC7OAUCO8eThvDspjghq1pH7Z3	55
24	103	102	\N	200.00	BRL	paid	\N	Pagamento sess├úo #56	\N	2026-04-01 18:06:29.049843-03	2026-04-01 18:06:58.596998-03	\N	cs_test_a1BrRDbMMhJEQbq1Fr4t0TXNBdavJsJ0UqeqOMm6dJ09uqalloFKq81LUb	56
25	103	102	\N	200.00	BRL	pending	\N	Pagamento sess├úo #67	\N	2026-04-03 13:00:44.363455-03	\N	\N	cs_test_a16MDDCWni0I0T9IqFSPGHKMlNjVr7AhP11XW8so6JA55moHDeMbUNdbcj	67
26	103	102	\N	200.00	BRL	pending	\N	Pagamento sess├úo #70	\N	2026-04-04 07:04:28.292898-03	\N	\N	cs_test_a1HfatqGB2kRawsLR3pH8JSDFkp7WHX1I30jD6gOUnWAhvzFMH3DfvMhwL	70
27	103	102	\N	200.00	BRL	pending	\N	Pagamento sess├úo #71	\N	2026-04-04 07:51:20.82871-03	\N	\N	cs_test_a1ohCFGnPCSmucI27hddvwnP0xpnRRlVHxLHeWfQOQVlBNBxHQPR2OCo6j	71
28	103	102	\N	200.00	BRL	pending	\N	Pagamento sess├úo #72	\N	2026-04-04 07:58:06.212068-03	\N	\N	cs_test_a1Ic6IuDypE7pXFro5GDHlEIZrCmB0afTIzGuyOOclBLYeBJRSC1Nqq3Ne	72
29	103	102	\N	200.00	BRL	pending	\N	Pagamento sess├úo #73	\N	2026-04-04 08:05:36.632374-03	\N	\N	cs_test_a1GqdqJG4AE64gFYbWI6RAH63BAYLeUPAhQEiZ8ThZTX9M2GNhIMn6oPCT	73
30	103	102	\N	200.00	BRL	pending	\N	Pagamento sess├úo #74	\N	2026-04-04 08:12:30.360012-03	\N	\N	cs_test_a1AajqaKZKhRIBqKoZbr1CLpk9G0fFFcNibzkewHLHx55vbJZ1wxc1yBnU	74
31	103	102	\N	200.00	BRL	pending	\N	Pagamento sess├úo #75	\N	2026-04-04 08:28:45.506002-03	\N	\N	cs_test_a19aDvUN0oChJe4QWRMHcyw0xLfQjKsZ8mkBoONRNvaeGT4q0EvRJg5d51	75
32	103	102	\N	200.00	BRL	pending	\N	Pagamento sess├úo #76	\N	2026-04-04 11:53:30.436403-03	\N	\N	cs_test_a1GeAq1PwsXFACuOWNoFySx6ooL9x8cDVnFaKdPZIav6hM7cq1btFhnLNp	76
33	103	102	\N	200.00	BRL	pending	\N	Pagamento sess├úo #77	\N	2026-04-04 12:53:44.305352-03	\N	\N	cs_test_a1xtSIGeuXoOdjvoZriAhiAPTpRH7HjTS4nI5Ooe0USwcpCYHJr9FbFsmQ	77
34	103	102	\N	200.00	BRL	pending	\N	Pagamento sess├úo #78	\N	2026-04-04 13:11:09.90805-03	\N	\N	cs_test_a1B3fTPT6H6juft4uCCtx3ZI7uJdXExI5tET6Ep8xrmnakp0gCK8hvTm1W	78
35	103	102	\N	200.00	BRL	paid	\N	Pagamento sess├úo #79	\N	2026-04-04 13:25:36.948306-03	2026-04-04 13:25:59.984798-03	\N	cs_test_a1DRzDku0mrbh98olCsAT5MJL55bgnf1IssvrBcATUNs2PtY18HL0mCieJ	79
36	103	102	\N	200.00	BRL	paid	\N	Pagamento sess├úo #80	\N	2026-04-05 12:25:43.378666-03	2026-04-05 12:26:13.134664-03	\N	cs_test_a17I94kC814iHd2P2GqUGUr1AHv2jJN5GNIvy4NRhyviRQXyhmL1AQaW6e	80
37	103	102	\N	200.00	BRL	paid	\N	Pagamento sess├úo #81	\N	2026-04-05 12:51:31.226237-03	2026-04-05 12:51:56.095092-03	\N	cs_test_a1SvP6MnhZCipmvfQXXHQimLvwYFEAD5jpLWoScXsBaYGzUSUMrXK2cIhY	81
\.


--
-- Data for Name: pending_bookings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pending_bookings (id, user_id, therapist_id, starts_at, ends_at, session_price, current_balance, missing_amount, checkout_session_id, payment_intent_id, status, created_at, updated_at, expires_at, extra_data) FROM stdin;
\.


--
-- Data for Name: personal_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.personal_events (id, therapist_id, type, title, patient_user_id, starts_at, ends_at, created_at, updated_at) FROM stdin;
1	3	PERSONAL	Dentista	\N	2026-04-01 17:00:00-03	2026-04-01 18:00:00-03	2026-03-31 21:23:43.44849-03	2026-04-01 07:04:40.98759-03
\.


--
-- Data for Name: plan_features_config; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.plan_features_config (id, feature_id, feature_name, description, is_active, available_in_essencial, available_in_profissional, available_in_premium, updated_at) FROM stdin;
1	max_patients_10	Limite de 10 pacientes	At├® 10 pacientes ativos	t	t	f	f	2026-04-06 03:07:05.892994-03
2	max_patients_50	Limite de 50 pacientes	At├® 50 pacientes ativos	t	f	t	f	2026-04-06 03:07:05.893007-03
3	max_patients_unlimited	Pacientes ilimitados	Sem limite de pacientes	t	f	f	t	2026-04-06 03:07:05.893012-03
4	commission_20	Comiss├úo 20%	Taxa de comiss├úo de 20%	t	t	f	f	2026-04-06 03:07:05.893016-03
5	commission_10	Comiss├úo 10%	Taxa de comiss├úo de 10%	t	f	t	f	2026-04-06 03:07:05.893021-03
6	commission_3	Comiss├úo 3%	Taxa de comiss├úo de 3%	t	f	f	t	2026-04-06 03:07:05.893026-03
7	financial_reports	Relat├│rios Financeiros	Acesso a relat├│rios financeiros	t	f	t	t	2026-04-06 03:07:05.893031-03
8	advanced_stats	Estat├¡sticas Avan├ºadas	M├®tricas e an├ílises detalhadas	t	f	t	t	2026-04-06 03:07:05.893038-03
9	priority_support	Suporte Priorit├írio	Atendimento priorit├írio	t	f	f	t	2026-04-06 03:07:05.893043-03
10	chat_support	Chat de Suporte	Suporte via chat	t	f	t	t	2026-04-06 03:07:05.893047-03
11	ai_microphone	Microfone com IA	Transcri├º├úo e rascunho de prontu├írio com IA	f	f	f	t	2026-04-06 03:07:05.893051-03
12	video_call	Videochamada	Sess├Áes por videochamada	t	t	t	t	2026-04-06 03:07:05.893056-03
13	digital_prontuary	Prontu├írio Digital	Registro de prontu├írios	t	t	t	t	2026-04-06 03:07:05.89306-03
14	calendar_sync	Sincroniza├º├úo com Google Calendar	Sync bidirecional	t	t	t	t	2026-04-06 03:07:05.893064-03
\.


--
-- Data for Name: plan_prices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.plan_prices (id, plan, price_cents, price_brl, updated_at, updated_by) FROM stdin;
1	profissional	7900	79.00	2026-04-05 21:11:11.534716-03	\N
2	premium	14900	149.00	2026-04-05 21:11:11.534716-03	\N
\.


--
-- Data for Name: session_documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.session_documents (id, session_id, document_type, file_url, file_name, file_size, mime_type, created_at) FROM stdin;
\.


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.subscriptions (id, therapist_id, plan, status, stripe_subscription_id, stripe_customer_id, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at) FROM stdin;
1	3	essencial	active	\N	\N	\N	\N	f	2026-04-04 13:08:32.142728	2026-04-04 13:08:32.142728
\.


--
-- Data for Name: therapist_addresses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.therapist_addresses (id, therapist_id, cep, street, number, complement, neighborhood, city, state, country, is_default, created_at, updated_at) FROM stdin;
2	3	31340-010	Rua Jesus Machado Gontijo	57	Apto 102	Ouro Preto	Belo Horizonte	MG	Brasil	t	2026-04-05 07:21:34.557878	2026-04-05 07:21:48.498863
\.


--
-- Data for Name: therapist_availabilities; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.therapist_availabilities (id, weekday, start_time, end_time, therapist_profile_id) FROM stdin;
\.


--
-- Data for Name: therapist_documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.therapist_documents (id, therapist_id, document_type, document_url, original_filename, file_size, uploaded_at, validation_status, validated_by, validated_at, rejection_reason) FROM stdin;
1	3	diploma	/uploads/therapist_documents/therapist_3_diploma_20260406_091252.pdf	Diploma de P├│s-Gradua├º├úo em Psican├ílise.pdf	\N	2026-04-06 12:12:52.491253-03	approved	6	2026-04-06 10:53:48.306432-03	\N
2	3	registration	/uploads/therapist_documents/therapist_3_registration_20260406_091252.pdf	Registro da Ordem dos Psicanalistas.pdf	\N	2026-04-06 12:12:52.553049-03	approved	6	2026-04-06 10:57:29.552676-03	\N
\.


--
-- Data for Name: therapist_invoices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.therapist_invoices (id, therapist_id, year, month, invoice_number, invoice_date, invoice_url, amount, status, admin_notes, reviewed_by, reviewed_at, created_at, updated_at) FROM stdin;
1	3	2026	2	0007	2026-04-25 00:00:00	/uploads/invoices/therapist_3_0007_20260407_220431.pdf	200.00	APPROVED	aprovado	6	2026-04-08 07:30:29.759901	2026-04-07 22:04:31.625303-03	2026-04-08 07:30:29.724044-03
\.


--
-- Data for Name: therapist_payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.therapist_payments (id, therapist_id, year, month, amount, commission_amount, status, paid_at, paid_by, created_at) FROM stdin;
\.


--
-- Data for Name: therapist_profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.therapist_profiles (id, user_id, bio, specialties, session_price, foto_url, experiencia, abordagem, idiomas, reviews_count, sessions_count, created_at, updated_at, rating, gender, ethnicity, lgbtqia_ally, formation, approaches, specialties_list, reasons, service_types, languages_list, rating_distribution, total_sessions, verified, featured, cancellation_policy, session_duration_30min, session_duration_50min, instagram_url, full_name, professional_registration, treatment, lgbtqia_belonging, phone, birth_date, show_phone_to_patients, show_birth_date_to_patients, signature_url, video_url, cnpj, cpf, bank_agency, bank_account, bank_account_digit, pix_key_type, pix_key, lgpd_consent, lgpd_consent_date, cpf_masked, payment_change_deadline, payment_change_deadline_message, education_level, chat_enabled, blocked_patients, stripe_customer_id, google_calendar_token, google_calendar_enabled, validation_status, is_verified) FROM stdin;
3	10	Ol├í, sou o Psicanalista Dr. Alexandre Alonso.\nDr. em Psican├ílise, Esp. em Neuropsican├ílise, Psican├ílise Winnicottiana e Teorias psicanal├¡ticas.\nEspecialista em TDAH, Compuls├úo, sexualidade, fam├¡lia, carreira, angustias, luto, culpa e depress├úo.\nSess├Áes de 45 minutos.\n@psicanalista.alexandrealonso	Psican├ílise	200.00	/uploads/therapists/therapist_10_65fd3bd2555442f695b19cfd33c6d972.png	FORMA├ç├âO\nGradua├º├úo - Cientista Social - Universidade Federal do Esp├¡rito Santo (UFES) - Conclus├úo em 2010\nPsican├ílise Cl├¡nica - Associa├º├úo Brasileira de Psican├ílise Insight - Conclus├úo em 2015\nMestrado - Psican├ílise - Associa├º├úo Brasileira de Psican├ílise Insight - Conclus├úo em 2016\nTeorias Psicanal├¡ticas - FACEL - Conclus├úo em 2017\nDoutorado - Sociologia - Universidad Cat├│lica Argentina (UCA) - Conclus├úo em 2019\nCurso - Psican├ílise - FAVENI - Conclus├úo em 2020\nNeuropsican├ílise - Unyleya - Conclus├úo em 2021\nPsican├ílise Winnicottiana - Unyleya - Conclus├úo em 2023\nDESCRI├ç├âO PESSOAL\nMembro Psicanalista S├¬nior ONP (Ordem Nacional dos Psicanalistas)\n\nMo├º├úo pelos relevantes servi├ºos prestados em favor da Psican├ílise pela Ordem Nacional dos Psicanalistas (ONP)\n\nMembro da International Psychoanalytical Association (IPA)\n\nDR. ALEXANDRE ALONSO\nPsicanalista Cl├¡nico e Cientista Social - Soci├│logo e Antrop├│logo, de nacionalidade Brasileira - nascido em 13 de novembro de 1981 na cidade de Belo Horizonte ÔÇô Minas Gerais.\n\nAos 34 anos (2015), motivado pela possibilidade de entender o ser humano e o inconsciente e estender os benef├¡cios da terapia psicanal├¡tica para outros, empreendeu este esfor├ºo de concluir uma s├│lida forma├º├úo na Psican├ílise.\n\nPesquisador em ci├¬ncias sociais do trabalho e a escuta psicanal├¡tica aplicado ao trabalho. Especialista em ang├║stia relacionadas ao trabalho, estresse laboral e conflitos decorrente do ambiente de trabalho.	Psican├ílise Winnicotiana, Psican├ílise Freudiana, Neuropsican├ílise	Remarca├º├Áes podem ocorrer at├® 24 hora(s) antes sem custo adicional	0	0	2026-03-16 14:37:10.049974-03	2026-04-06 10:57:29.594233-03	0.0	homem	branca	t	doutorado	["Psican├ílise", "Psican├ílise Winnicottiana", "Neuropsican├ílise", "Terapia de Casal"]	["Ansiedade", "Autoestima", "Luto", "TOC", "Depress├úo", "Estresse", "Trauma", "Relacionamentos", "Burnout", "Fobias"]	["Ansiedade", "Autoestima", "Luto", "TOC", "Transtornos Alimentares", "Abuso", "Depress├úo", "Estresse", "Trauma", "P├ónico", "Sexualidade", "Viol├¬ncia", "Relacionamentos", "Burnout", "Fobias", "Depend├¬ncia Qu├¡mica", "G├¬nero"]	["psicanalista"]	["Portugu├¬s", "Ingl├¬s", "Espanhol"]	\N	0	f	f	\N	f	t	https://www.instagram.com/psicanalista.alexandrealonso/	Alexandre Alonso	\N	DR	f	(31) 98335-4457	1981-11-13	t	f	\N	https://www.youtube.com/watch?v=ThSrK-C46OM	37.655.845/0001-25	044.538.286-40	\N	\N	\N	CNPJ	37655845000125	t	2026-03-30 19:17:53.508784	\N	last_day_of_month	\N	Doutorado	t	{}	cus_UHb7ImjYWpXK5i	\N	f	approved	t
\.


--
-- Data for Name: therapist_ratings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.therapist_ratings (id, therapist_id, patient_id, session_id, rating, comment, is_anonymous, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: therapist_validation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.therapist_validation (id, therapist_id, validation_status, validated_by, validated_at, rejection_reason, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_permissions (id, user_id, permission_id, granted, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, full_name, password_hash, role, is_active, created_at, is_verified, two_factor_enabled, email_notifications_enabled, email_preferences) FROM stdin;
1	admin@meudiva.com	\N	$argon2id$v=19$m=65536,t=3,p=4$23svxXjvfW8tJWSsdW6tdQ$Th5FnOYcDI5TFTpT+RCklSGB/cxsYRGp1c81V+3YQDg	admin	t	2026-03-05 08:30:28.32518-03	f	f	t	{"email_changed": true, "password_reset": true, "invite_received": true, "payment_received": true, "appointment_created": true, "appointment_cancelled": true, "appointment_confirmed": true, "appointment_rescheduled": true}
6	admin@test.com	Sigmund Freud	$argon2id$v=19$m=65536,t=3,p=4$SmmNkXKuNUYIgVBqba0VQg$jbuZV+kQgQZid70x7vPCcvlq+hh9+t/IunkO47yEFF0	admin	t	2026-03-07 14:53:51.73756-03	f	f	t	{"email_changed": true, "password_reset": true, "invite_received": true, "payment_received": true, "appointment_created": true, "appointment_cancelled": true, "appointment_confirmed": true, "appointment_rescheduled": true}
18	patient0@test.com	Donald Winnicott	$argon2id$v=19$m=65536,t=3,p=4$LyVkjDHmXKv1npOy1hrD+A$aUsgvKLPhc52SPzccp/470RM8Ef8wKbhIrmPB9TGn58	patient	t	2026-03-12 09:22:36.150238-03	f	f	t	{"email_changed": true, "password_reset": true, "invite_received": true, "payment_received": true, "appointment_created": true, "appointment_cancelled": true, "appointment_confirmed": true, "appointment_rescheduled": true}
110	patient92@test.com	Anna Freud	$argon2id$v=19$m=65536,t=3,p=4$gtB6z3kPIYRwDiFkjHHufQ$mVV/tYnD9D7pPMhZ9K0mjXyqIHKcCnvbST99SJGBlQ4	patient	t	2026-03-12 09:22:44.038527-03	f	f	t	{"email_changed": true, "password_reset": true, "invite_received": true, "payment_received": true, "appointment_created": true, "appointment_cancelled": true, "appointment_confirmed": true, "appointment_rescheduled": true}
10	therapist2@test.com	Alexandre Alonso	$argon2id$v=19$m=65536,t=3,p=4$Z4yRck4ppTQmZKyVsrZWqg$VaUI4s9XNuIbFdbh5VKvvacfKvf9ZSD/x8Vsl+ZV2ow	therapist	t	2026-03-12 09:22:35.451533-03	f	f	t	{"email_changed": true, "password_reset": true, "invite_received": true, "payment_received": true, "appointment_created": true, "appointment_cancelled": true, "appointment_confirmed": true, "appointment_rescheduled": true}
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.wallets (id, patient_id, balance, currency, created_at, updated_at) FROM stdin;
102	103	100.00	BRL	2026-03-16 19:39:58.664279-03	2026-04-01 15:59:12.170005-03
206	35	2900.00	BRL	2026-03-16 19:39:58.664279-03	2026-03-17 20:53:04.987725-03
\.


--
-- Name: admin_profiles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.admin_profiles_id_seq', 1, true);


--
-- Name: appointment_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.appointment_events_id_seq', 151, true);


--
-- Name: appointments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.appointments_id_seq', 83, true);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 74, true);


--
-- Name: availability_periods_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.availability_periods_id_seq', 11, true);


--
-- Name: availability_slots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.availability_slots_id_seq', 58, true);


--
-- Name: chat_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.chat_messages_id_seq', 17, true);


--
-- Name: chat_threads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.chat_threads_id_seq', 5, true);


--
-- Name: commissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.commissions_id_seq', 11, true);


--
-- Name: goal_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.goal_types_id_seq', 6, true);


--
-- Name: ledger_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ledger_id_seq', 81, true);


--
-- Name: medical_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.medical_records_id_seq', 15, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 13, true);


--
-- Name: patient_addresses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.patient_addresses_id_seq', 6, true);


--
-- Name: patient_billing_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.patient_billing_id_seq', 1, false);


--
-- Name: patient_favorites_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.patient_favorites_id_seq', 1, false);


--
-- Name: patient_goals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.patient_goals_id_seq', 5, true);


--
-- Name: patient_profiles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.patient_profiles_id_seq', 206, true);


--
-- Name: patient_security_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.patient_security_id_seq', 1, false);


--
-- Name: patient_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.patient_sessions_id_seq', 1, false);


--
-- Name: patient_statistics_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.patient_statistics_id_seq', 1, false);


--
-- Name: patient_subscriptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.patient_subscriptions_id_seq', 1, false);


--
-- Name: payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payments_id_seq', 38, true);


--
-- Name: pending_bookings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pending_bookings_id_seq', 1, false);


--
-- Name: personal_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.personal_events_id_seq', 4, true);


--
-- Name: plan_features_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.plan_features_config_id_seq', 14, true);


--
-- Name: plan_prices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.plan_prices_id_seq', 2, true);


--
-- Name: session_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.session_documents_id_seq', 1, false);


--
-- Name: subscriptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.subscriptions_id_seq', 1, true);


--
-- Name: therapist_addresses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.therapist_addresses_id_seq', 2, true);


--
-- Name: therapist_availabilities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.therapist_availabilities_id_seq', 1, false);


--
-- Name: therapist_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.therapist_documents_id_seq', 2, true);


--
-- Name: therapist_invoices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.therapist_invoices_id_seq', 1, true);


--
-- Name: therapist_payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.therapist_payments_id_seq', 1, false);


--
-- Name: therapist_profiles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.therapist_profiles_id_seq', 171, true);


--
-- Name: therapist_ratings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.therapist_ratings_id_seq', 1, false);


--
-- Name: therapist_validation_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.therapist_validation_id_seq', 1, false);


--
-- Name: user_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_permissions_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 220, true);


--
-- Name: wallets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.wallets_id_seq', 206, true);


--
-- Name: admin_profiles admin_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_profiles
    ADD CONSTRAINT admin_profiles_pkey PRIMARY KEY (id);


--
-- Name: admin_profiles admin_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_profiles
    ADD CONSTRAINT admin_profiles_user_id_key UNIQUE (user_id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: appointment_events appointment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_events
    ADD CONSTRAINT appointment_events_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: availability_periods availability_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_periods
    ADD CONSTRAINT availability_periods_pkey PRIMARY KEY (id);


--
-- Name: availability_slots availability_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_slots
    ADD CONSTRAINT availability_slots_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_threads chat_threads_patient_id_therapist_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_threads
    ADD CONSTRAINT chat_threads_patient_id_therapist_id_key UNIQUE (patient_id, therapist_id);


--
-- Name: chat_threads chat_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_threads
    ADD CONSTRAINT chat_threads_pkey PRIMARY KEY (id);


--
-- Name: commissions commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commissions
    ADD CONSTRAINT commissions_pkey PRIMARY KEY (id);


--
-- Name: goal_types goal_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_types
    ADD CONSTRAINT goal_types_name_key UNIQUE (name);


--
-- Name: goal_types goal_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_types
    ADD CONSTRAINT goal_types_pkey PRIMARY KEY (id);


--
-- Name: ledger ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger
    ADD CONSTRAINT ledger_pkey PRIMARY KEY (id);


--
-- Name: medical_records medical_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_records
    ADD CONSTRAINT medical_records_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: patient_addresses patient_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_addresses
    ADD CONSTRAINT patient_addresses_pkey PRIMARY KEY (id);


--
-- Name: patient_billing patient_billing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_billing
    ADD CONSTRAINT patient_billing_pkey PRIMARY KEY (id);


--
-- Name: patient_favorites patient_favorites_patient_id_therapist_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_favorites
    ADD CONSTRAINT patient_favorites_patient_id_therapist_id_key UNIQUE (patient_id, therapist_id);


--
-- Name: patient_favorites patient_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_favorites
    ADD CONSTRAINT patient_favorites_pkey PRIMARY KEY (id);


--
-- Name: patient_goals patient_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_goals
    ADD CONSTRAINT patient_goals_pkey PRIMARY KEY (id);


--
-- Name: patient_profiles patient_profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_profiles
    ADD CONSTRAINT patient_profiles_email_key UNIQUE (email);


--
-- Name: patient_profiles patient_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_profiles
    ADD CONSTRAINT patient_profiles_pkey PRIMARY KEY (id);


--
-- Name: patient_profiles patient_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_profiles
    ADD CONSTRAINT patient_profiles_user_id_key UNIQUE (user_id);


--
-- Name: patient_security patient_security_patient_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_security
    ADD CONSTRAINT patient_security_patient_id_key UNIQUE (patient_id);


--
-- Name: patient_security patient_security_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_security
    ADD CONSTRAINT patient_security_pkey PRIMARY KEY (id);


--
-- Name: patient_sessions patient_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_sessions
    ADD CONSTRAINT patient_sessions_pkey PRIMARY KEY (id);


--
-- Name: patient_statistics patient_statistics_patient_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_statistics
    ADD CONSTRAINT patient_statistics_patient_id_key UNIQUE (patient_id);


--
-- Name: patient_statistics patient_statistics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_statistics
    ADD CONSTRAINT patient_statistics_pkey PRIMARY KEY (id);


--
-- Name: patient_subscriptions patient_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_subscriptions
    ADD CONSTRAINT patient_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: payments payments_stripe_payment_intent_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_stripe_payment_intent_id_key UNIQUE (stripe_payment_intent_id);


--
-- Name: payments payments_stripe_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_stripe_session_id_key UNIQUE (stripe_session_id);


--
-- Name: pending_bookings pending_bookings_checkout_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_bookings
    ADD CONSTRAINT pending_bookings_checkout_session_id_key UNIQUE (checkout_session_id);


--
-- Name: pending_bookings pending_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_bookings
    ADD CONSTRAINT pending_bookings_pkey PRIMARY KEY (id);


--
-- Name: personal_events personal_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_events
    ADD CONSTRAINT personal_events_pkey PRIMARY KEY (id);


--
-- Name: plan_features_config plan_features_config_feature_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_features_config
    ADD CONSTRAINT plan_features_config_feature_id_key UNIQUE (feature_id);


--
-- Name: plan_features_config plan_features_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_features_config
    ADD CONSTRAINT plan_features_config_pkey PRIMARY KEY (id);


--
-- Name: plan_prices plan_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_prices
    ADD CONSTRAINT plan_prices_pkey PRIMARY KEY (id);


--
-- Name: plan_prices plan_prices_plan_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_prices
    ADD CONSTRAINT plan_prices_plan_key UNIQUE (plan);


--
-- Name: session_documents session_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_documents
    ADD CONSTRAINT session_documents_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: therapist_addresses therapist_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_addresses
    ADD CONSTRAINT therapist_addresses_pkey PRIMARY KEY (id);


--
-- Name: therapist_availabilities therapist_availabilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_availabilities
    ADD CONSTRAINT therapist_availabilities_pkey PRIMARY KEY (id);


--
-- Name: therapist_documents therapist_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_documents
    ADD CONSTRAINT therapist_documents_pkey PRIMARY KEY (id);


--
-- Name: therapist_documents therapist_documents_therapist_id_document_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_documents
    ADD CONSTRAINT therapist_documents_therapist_id_document_type_key UNIQUE (therapist_id, document_type);


--
-- Name: therapist_invoices therapist_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_invoices
    ADD CONSTRAINT therapist_invoices_pkey PRIMARY KEY (id);


--
-- Name: therapist_payments therapist_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_payments
    ADD CONSTRAINT therapist_payments_pkey PRIMARY KEY (id);


--
-- Name: therapist_profiles therapist_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_profiles
    ADD CONSTRAINT therapist_profiles_pkey PRIMARY KEY (id);


--
-- Name: therapist_profiles therapist_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_profiles
    ADD CONSTRAINT therapist_profiles_user_id_key UNIQUE (user_id);


--
-- Name: therapist_ratings therapist_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_ratings
    ADD CONSTRAINT therapist_ratings_pkey PRIMARY KEY (id);


--
-- Name: therapist_ratings therapist_ratings_therapist_id_patient_id_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_ratings
    ADD CONSTRAINT therapist_ratings_therapist_id_patient_id_session_id_key UNIQUE (therapist_id, patient_id, session_id);


--
-- Name: therapist_validation therapist_validation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_validation
    ADD CONSTRAINT therapist_validation_pkey PRIMARY KEY (id);


--
-- Name: wallets unique_patient_wallet; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT unique_patient_wallet UNIQUE (patient_id);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_user_id_permission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_permission_id_key UNIQUE (user_id, permission_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: idx_appointment_events_actor_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointment_events_actor_user_id ON public.appointment_events USING btree (actor_user_id);


--
-- Name: idx_appointment_events_appointment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointment_events_appointment_id ON public.appointment_events USING btree (appointment_id);


--
-- Name: idx_appointment_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointment_events_created_at ON public.appointment_events USING btree (created_at);


--
-- Name: idx_appointments_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_payment_status ON public.appointments USING btree (payment_status);


--
-- Name: idx_appointments_wallet_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_wallet_id ON public.appointments USING btree (wallet_id);


--
-- Name: idx_audit_logs_action_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action_type ON public.audit_logs USING btree (action_type);


--
-- Name: idx_audit_logs_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs USING btree ("timestamp");


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_availability_periods_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_availability_periods_dates ON public.availability_periods USING btree (start_date, end_date);


--
-- Name: idx_availability_periods_therapist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_availability_periods_therapist ON public.availability_periods USING btree (therapist_profile_id);


--
-- Name: idx_availability_slots_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_availability_slots_period ON public.availability_slots USING btree (period_id);


--
-- Name: idx_chat_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_created ON public.chat_messages USING btree (created_at);


--
-- Name: idx_chat_messages_sender_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_sender_id ON public.chat_messages USING btree (sender_id);


--
-- Name: idx_chat_messages_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_thread_id ON public.chat_messages USING btree (thread_id);


--
-- Name: idx_chat_threads_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_threads_patient ON public.chat_threads USING btree (patient_user_id);


--
-- Name: idx_chat_threads_therapist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_threads_therapist ON public.chat_threads USING btree (therapist_user_id);


--
-- Name: idx_commissions_appointment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commissions_appointment ON public.commissions USING btree (appointment_id);


--
-- Name: idx_commissions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commissions_created_at ON public.commissions USING btree (created_at);


--
-- Name: idx_commissions_therapist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commissions_therapist ON public.commissions USING btree (therapist_id);


--
-- Name: idx_ledger_appointment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ledger_appointment_id ON public.ledger USING btree (appointment_id);


--
-- Name: idx_ledger_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ledger_created_at ON public.ledger USING btree (created_at);


--
-- Name: idx_ledger_transaction_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ledger_transaction_type ON public.ledger USING btree (transaction_type);


--
-- Name: idx_ledger_wallet_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ledger_wallet_id ON public.ledger USING btree (wallet_id);


--
-- Name: idx_medical_records_appointment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medical_records_appointment_id ON public.medical_records USING btree (appointment_id);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_type ON public.notifications USING btree (type);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_patient_favorites_patient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_favorites_patient_id ON public.patient_favorites USING btree (patient_id);


--
-- Name: idx_patient_profiles_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_profiles_email ON public.patient_profiles USING btree (email);


--
-- Name: idx_patient_profiles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_profiles_user_id ON public.patient_profiles USING btree (user_id);


--
-- Name: idx_patient_sessions_patient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_sessions_patient_id ON public.patient_sessions USING btree (patient_id);


--
-- Name: idx_patient_sessions_session_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_sessions_session_date ON public.patient_sessions USING btree (session_date);


--
-- Name: idx_patient_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_sessions_status ON public.patient_sessions USING btree (status);


--
-- Name: idx_patient_sessions_therapist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_sessions_therapist_id ON public.patient_sessions USING btree (therapist_id);


--
-- Name: idx_payments_patient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_patient_id ON public.payments USING btree (patient_id);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_status ON public.payments USING btree (status);


--
-- Name: idx_payments_stripe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_stripe_id ON public.payments USING btree (stripe_payment_intent_id);


--
-- Name: idx_payments_wallet_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_wallet_id ON public.payments USING btree (wallet_id);


--
-- Name: idx_pending_bookings_checkout_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_bookings_checkout_session_id ON public.pending_bookings USING btree (checkout_session_id);


--
-- Name: idx_pending_bookings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_bookings_status ON public.pending_bookings USING btree (status);


--
-- Name: idx_pending_bookings_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_bookings_user_id ON public.pending_bookings USING btree (user_id);


--
-- Name: idx_personal_events_starts_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personal_events_starts_at ON public.personal_events USING btree (starts_at);


--
-- Name: idx_personal_events_therapist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personal_events_therapist_id ON public.personal_events USING btree (therapist_id);


--
-- Name: idx_session_documents_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_documents_session_id ON public.session_documents USING btree (session_id);


--
-- Name: idx_subscriptions_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_plan ON public.subscriptions USING btree (plan);


--
-- Name: idx_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);


--
-- Name: idx_subscriptions_therapist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_therapist ON public.subscriptions USING btree (therapist_id);


--
-- Name: idx_therapist_addresses_therapist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_therapist_addresses_therapist ON public.therapist_addresses USING btree (therapist_id);


--
-- Name: idx_therapist_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_therapist_invoices_status ON public.therapist_invoices USING btree (status);


--
-- Name: idx_therapist_invoices_therapist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_therapist_invoices_therapist_id ON public.therapist_invoices USING btree (therapist_id);


--
-- Name: idx_therapist_invoices_year_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_therapist_invoices_year_month ON public.therapist_invoices USING btree (year, month);


--
-- Name: idx_therapist_payments_therapist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_therapist_payments_therapist_id ON public.therapist_payments USING btree (therapist_id);


--
-- Name: idx_therapist_payments_year_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_therapist_payments_year_month ON public.therapist_payments USING btree (year, month);


--
-- Name: idx_therapist_ratings_therapist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_therapist_ratings_therapist_id ON public.therapist_ratings USING btree (therapist_id);


--
-- Name: idx_user_permissions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_permissions_user_id ON public.user_permissions USING btree (user_id);


--
-- Name: idx_wallets_balance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallets_balance ON public.wallets USING btree (balance);


--
-- Name: idx_wallets_patient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallets_patient_id ON public.wallets USING btree (patient_id);


--
-- Name: ix_appointments_patient_starts_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_appointments_patient_starts_at ON public.appointments USING btree (patient_user_id, starts_at);


--
-- Name: ix_appointments_therapist_starts_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_appointments_therapist_starts_at ON public.appointments USING btree (therapist_user_id, starts_at);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: wallets update_wallets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: admin_profiles admin_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_profiles
    ADD CONSTRAINT admin_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: appointment_events appointment_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_events
    ADD CONSTRAINT appointment_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id);


--
-- Name: appointment_events appointment_events_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_events
    ADD CONSTRAINT appointment_events_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_patient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_patient_user_id_fkey FOREIGN KEY (patient_user_id) REFERENCES public.users(id);


--
-- Name: appointments appointments_rescheduled_from_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_rescheduled_from_id_fkey FOREIGN KEY (rescheduled_from_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_therapist_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_therapist_user_id_fkey FOREIGN KEY (therapist_user_id) REFERENCES public.users(id);


--
-- Name: appointments appointments_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: audit_logs audit_logs_patient_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_patient_profile_id_fkey FOREIGN KEY (patient_profile_id) REFERENCES public.patient_profiles(id);


--
-- Name: audit_logs audit_logs_therapist_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_therapist_profile_id_fkey FOREIGN KEY (therapist_profile_id) REFERENCES public.therapist_profiles(id);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: availability_periods availability_periods_therapist_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_periods
    ADD CONSTRAINT availability_periods_therapist_profile_id_fkey FOREIGN KEY (therapist_profile_id) REFERENCES public.therapist_profiles(id) ON DELETE CASCADE;


--
-- Name: availability_slots availability_slots_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_slots
    ADD CONSTRAINT availability_slots_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.availability_periods(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id);


--
-- Name: chat_messages chat_messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.chat_threads(id) ON DELETE CASCADE;


--
-- Name: chat_threads chat_threads_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_threads
    ADD CONSTRAINT chat_threads_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patient_profiles(id) ON DELETE CASCADE;


--
-- Name: chat_threads chat_threads_patient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_threads
    ADD CONSTRAINT chat_threads_patient_user_id_fkey FOREIGN KEY (patient_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chat_threads chat_threads_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_threads
    ADD CONSTRAINT chat_threads_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapist_profiles(id) ON DELETE CASCADE;


--
-- Name: chat_threads chat_threads_therapist_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_threads
    ADD CONSTRAINT chat_threads_therapist_user_id_fkey FOREIGN KEY (therapist_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: commissions commissions_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commissions
    ADD CONSTRAINT commissions_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: commissions commissions_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commissions
    ADD CONSTRAINT commissions_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapist_profiles(id) ON DELETE CASCADE;


--
-- Name: ledger ledger_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger
    ADD CONSTRAINT ledger_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: ledger ledger_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger
    ADD CONSTRAINT ledger_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets(id) ON DELETE CASCADE;


--
-- Name: medical_records medical_records_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_records
    ADD CONSTRAINT medical_records_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: patient_addresses patient_addresses_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_addresses
    ADD CONSTRAINT patient_addresses_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patient_profiles(id) ON DELETE CASCADE;


--
-- Name: patient_billing patient_billing_billing_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_billing
    ADD CONSTRAINT patient_billing_billing_address_id_fkey FOREIGN KEY (billing_address_id) REFERENCES public.patient_addresses(id);


--
-- Name: patient_billing patient_billing_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_billing
    ADD CONSTRAINT patient_billing_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patient_profiles(id) ON DELETE CASCADE;


--
-- Name: patient_favorites patient_favorites_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_favorites
    ADD CONSTRAINT patient_favorites_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patient_profiles(id) ON DELETE CASCADE;


--
-- Name: patient_favorites patient_favorites_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_favorites
    ADD CONSTRAINT patient_favorites_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapist_profiles(id) ON DELETE CASCADE;


--
-- Name: patient_goals patient_goals_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_goals
    ADD CONSTRAINT patient_goals_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patient_profiles(id) ON DELETE CASCADE;


--
-- Name: patient_profiles patient_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_profiles
    ADD CONSTRAINT patient_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: patient_security patient_security_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_security
    ADD CONSTRAINT patient_security_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patient_profiles(id) ON DELETE CASCADE;


--
-- Name: patient_sessions patient_sessions_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_sessions
    ADD CONSTRAINT patient_sessions_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: patient_sessions patient_sessions_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_sessions
    ADD CONSTRAINT patient_sessions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patient_profiles(id) ON DELETE CASCADE;


--
-- Name: patient_sessions patient_sessions_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_sessions
    ADD CONSTRAINT patient_sessions_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapist_profiles(id);


--
-- Name: patient_statistics patient_statistics_favorite_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_statistics
    ADD CONSTRAINT patient_statistics_favorite_therapist_id_fkey FOREIGN KEY (favorite_therapist_id) REFERENCES public.therapist_profiles(id);


--
-- Name: patient_statistics patient_statistics_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_statistics
    ADD CONSTRAINT patient_statistics_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patient_profiles(id) ON DELETE CASCADE;


--
-- Name: patient_subscriptions patient_subscriptions_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_subscriptions
    ADD CONSTRAINT patient_subscriptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patient_profiles(id) ON DELETE CASCADE;


--
-- Name: payments payments_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: payments payments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patient_profiles(id) ON DELETE CASCADE;


--
-- Name: payments payments_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets(id) ON DELETE CASCADE;


--
-- Name: pending_bookings pending_bookings_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_bookings
    ADD CONSTRAINT pending_bookings_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapist_profiles(id);


--
-- Name: pending_bookings pending_bookings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_bookings
    ADD CONSTRAINT pending_bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: personal_events personal_events_patient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_events
    ADD CONSTRAINT personal_events_patient_user_id_fkey FOREIGN KEY (patient_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: personal_events personal_events_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_events
    ADD CONSTRAINT personal_events_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapist_profiles(id) ON DELETE CASCADE;


--
-- Name: plan_prices plan_prices_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_prices
    ADD CONSTRAINT plan_prices_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: session_documents session_documents_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_documents
    ADD CONSTRAINT session_documents_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.patient_sessions(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapist_profiles(id) ON DELETE CASCADE;


--
-- Name: therapist_addresses therapist_addresses_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_addresses
    ADD CONSTRAINT therapist_addresses_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapist_profiles(id) ON DELETE CASCADE;


--
-- Name: therapist_availabilities therapist_availabilities_therapist_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_availabilities
    ADD CONSTRAINT therapist_availabilities_therapist_profile_id_fkey FOREIGN KEY (therapist_profile_id) REFERENCES public.therapist_profiles(id);


--
-- Name: therapist_documents therapist_documents_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_documents
    ADD CONSTRAINT therapist_documents_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapist_profiles(id) ON DELETE CASCADE;


--
-- Name: therapist_documents therapist_documents_validated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_documents
    ADD CONSTRAINT therapist_documents_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES public.users(id);


--
-- Name: therapist_invoices therapist_invoices_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_invoices
    ADD CONSTRAINT therapist_invoices_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: therapist_invoices therapist_invoices_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_invoices
    ADD CONSTRAINT therapist_invoices_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapist_profiles(id) ON DELETE CASCADE;


--
-- Name: therapist_payments therapist_payments_paid_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_payments
    ADD CONSTRAINT therapist_payments_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES public.users(id);


--
-- Name: therapist_payments therapist_payments_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_payments
    ADD CONSTRAINT therapist_payments_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapist_profiles(id) ON DELETE CASCADE;


--
-- Name: therapist_profiles therapist_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_profiles
    ADD CONSTRAINT therapist_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: therapist_ratings therapist_ratings_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_ratings
    ADD CONSTRAINT therapist_ratings_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patient_profiles(id) ON DELETE CASCADE;


--
-- Name: therapist_ratings therapist_ratings_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_ratings
    ADD CONSTRAINT therapist_ratings_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.patient_sessions(id);


--
-- Name: therapist_ratings therapist_ratings_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_ratings
    ADD CONSTRAINT therapist_ratings_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapist_profiles(id) ON DELETE CASCADE;


--
-- Name: therapist_validation therapist_validation_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_validation
    ADD CONSTRAINT therapist_validation_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapist_profiles(id) ON DELETE CASCADE;


--
-- Name: therapist_validation therapist_validation_validated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_validation
    ADD CONSTRAINT therapist_validation_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES public.users(id);


--
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: wallets wallets_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patient_profiles(id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- Name: TABLE admin_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.admin_profiles TO meudiva_user;


--
-- Name: SEQUENCE admin_profiles_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.admin_profiles_id_seq TO meudiva_user;


--
-- Name: TABLE appointments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.appointments TO PUBLIC;


--
-- Name: SEQUENCE appointments_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.appointments_id_seq TO PUBLIC;


--
-- Name: TABLE availability_periods; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.availability_periods TO PUBLIC;


--
-- Name: TABLE availability_slots; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.availability_slots TO PUBLIC;


--
-- Name: TABLE commissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.commissions TO PUBLIC;
GRANT ALL ON TABLE public.commissions TO meudiva_user;


--
-- Name: SEQUENCE commissions_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.commissions_id_seq TO PUBLIC;
GRANT SELECT,USAGE ON SEQUENCE public.commissions_id_seq TO meudiva_user;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notifications TO PUBLIC;
GRANT ALL ON TABLE public.notifications TO meudiva_user;


--
-- Name: SEQUENCE notifications_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.notifications_id_seq TO PUBLIC;
GRANT SELECT,USAGE ON SEQUENCE public.notifications_id_seq TO meudiva_user;


--
-- Name: TABLE patient_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.patient_profiles TO PUBLIC;


--
-- Name: SEQUENCE patient_profiles_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.patient_profiles_id_seq TO PUBLIC;


--
-- Name: TABLE plan_features_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.plan_features_config TO meudiva_user;


--
-- Name: SEQUENCE plan_features_config_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.plan_features_config_id_seq TO meudiva_user;


--
-- Name: TABLE plan_prices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.plan_prices TO meudiva_user;


--
-- Name: SEQUENCE plan_prices_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.plan_prices_id_seq TO meudiva_user;


--
-- Name: TABLE subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.subscriptions TO PUBLIC;
GRANT ALL ON TABLE public.subscriptions TO meudiva_user;


--
-- Name: SEQUENCE subscriptions_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.subscriptions_id_seq TO PUBLIC;
GRANT SELECT,USAGE ON SEQUENCE public.subscriptions_id_seq TO meudiva_user;


--
-- Name: TABLE therapist_addresses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.therapist_addresses TO PUBLIC;
GRANT ALL ON TABLE public.therapist_addresses TO meudiva_user;


--
-- Name: SEQUENCE therapist_addresses_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.therapist_addresses_id_seq TO PUBLIC;
GRANT SELECT,USAGE ON SEQUENCE public.therapist_addresses_id_seq TO meudiva_user;


--
-- Name: TABLE therapist_documents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.therapist_documents TO meudiva_user;


--
-- Name: SEQUENCE therapist_documents_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.therapist_documents_id_seq TO meudiva_user;


--
-- Name: TABLE therapist_invoices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.therapist_invoices TO PUBLIC;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.therapist_invoices TO meudiva_user;


--
-- Name: SEQUENCE therapist_invoices_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.therapist_invoices_id_seq TO meudiva_user;
GRANT ALL ON SEQUENCE public.therapist_invoices_id_seq TO PUBLIC;


--
-- Name: TABLE therapist_payments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.therapist_payments TO meudiva_user;
GRANT ALL ON TABLE public.therapist_payments TO PUBLIC;


--
-- Name: SEQUENCE therapist_payments_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.therapist_payments_id_seq TO meudiva_user;
GRANT ALL ON SEQUENCE public.therapist_payments_id_seq TO PUBLIC;


--
-- Name: TABLE therapist_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.therapist_profiles TO PUBLIC;


--
-- Name: SEQUENCE therapist_profiles_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.therapist_profiles_id_seq TO PUBLIC;


--
-- Name: TABLE therapist_validation; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.therapist_validation TO meudiva_user;


--
-- Name: SEQUENCE therapist_validation_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.therapist_validation_id_seq TO meudiva_user;


--
-- Name: TABLE user_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_permissions TO meudiva_user;


--
-- Name: SEQUENCE user_permissions_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.user_permissions_id_seq TO meudiva_user;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.users TO PUBLIC;


--
-- Name: SEQUENCE users_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.users_id_seq TO PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict 4hRpPPDxuFz7fJW89v4Pcyr2j8SqzLTsjeWcEHmW37v4oEjjhQmSHpZnrLi8ZsX

