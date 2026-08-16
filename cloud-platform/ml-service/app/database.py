"""Database layer — engine, metadata and table definitions (SQLAlchemy Core)."""
from sqlalchemy import (
    Column,
    Float,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    text,
)

metadata = MetaData()

pages_children = Table(
    'pages_children',
    metadata,
    Column('child_id', String, primary_key=True),
    Column('res_id', String, nullable=False),
    Column('grade', Integer, nullable=False),
    Column('camp_id', String, nullable=False),
    Column('zone_id', String),
    Column('language', String, nullable=False, server_default=text("'si'")),
    Column('enrolled_at', Text, nullable=False),
    Column('total_sessions', Integer, nullable=False, server_default=text('0')),
    Column('baseline_score', Float, nullable=False, server_default=text('60.0')),
    Column('consecutive_low', Integer, nullable=False, server_default=text('0')),
    Column('sdq_band', String, nullable=False, server_default=text("'unknown'")),
    Column('alert_status', String, nullable=False, server_default=text("'none'")),
    Column('synced', Integer, nullable=False, server_default=text('0')),
)

pages_sessions = Table(
    'pages_sessions',
    metadata,
    Column('session_id', String, primary_key=True),
    Column('child_id', String, ForeignKey('pages_children.child_id'), nullable=False),
    Column('content_session_id', String),
    Column('session_date', Text, nullable=False),
    Column('session_time', Text, nullable=False),
    Column('condition_label', String, nullable=False, server_default=text("'A'")),
    Column('composite_score', Float),
    Column('task_score', Float),
    Column('passive_score', Float),
    Column('baseline_score_used', Float, nullable=False),
    Column('gate_decision', String),
    Column('second_gate_score', Float),
    Column('cognitive_score', Float),
    Column('session_complete', Integer, nullable=False, server_default=text('0')),
    Column('anomaly_flagged', Integer, nullable=False, server_default=text('0')),
    Column('z_score', Float),
    Column('if_score', Float),
    Column('alert_triggered', Integer, nullable=False, server_default=text('0')),
    Column('synced', Integer, nullable=False, server_default=text('0')),
    Column('created_at', Text, nullable=False),
)

pages_behavioral_signals = Table(
    'pages_behavioral_signals',
    metadata,
    Column('signal_id', String, primary_key=True),
    Column('session_id', String, ForeignKey('pages_sessions.session_id'), nullable=False),
    Column('child_id', String, ForeignKey('pages_children.child_id'), nullable=False),
    Column('accuracy_rate', Float, nullable=False),
    Column('false_tap_rate', Float, nullable=False),
    Column('avg_reaction_time', Float, nullable=False),
    Column('reaction_variance', Float, nullable=False),
    Column('idle_time_ratio', Float, nullable=False),
    Column('rapid_click_count', Integer, nullable=False, server_default=text('0')),
    Column('time_to_first_ms', Float, nullable=False),
    Column('completion_ratio', Float, nullable=False),
    Column('synced', Integer, nullable=False, server_default=text('0')),
)

pages_gate_decisions = Table(
    'pages_gate_decisions',
    metadata,
    Column('decision_id', String, primary_key=True),
    Column('session_id', String, ForeignKey('pages_sessions.session_id'), nullable=False),
    Column('child_id', String, ForeignKey('pages_children.child_id'), nullable=False),
    Column('attempt_number', Integer, nullable=False),
    Column('composite_score', Float, nullable=False),
    Column('decision', String, nullable=False),
    Column('decided_at', Text, nullable=False),
    Column('synced', Integer, nullable=False, server_default=text('0')),
)

pages_alerts = Table(
    'pages_alerts',
    metadata,
    Column('alert_id', String, primary_key=True),
    Column('child_id', String, ForeignKey('pages_children.child_id'), nullable=False),
    Column('camp_id', String, nullable=False),
    Column('res_id', String, nullable=False),
    Column('alert_type', String, nullable=False),
    Column('trigger_detail', Text, nullable=False),
    Column('triggered_at', Text, nullable=False),
    Column('status', String, nullable=False, server_default=text("'pending'")),
    Column('resolved_at', Text),
    Column('resolved_notes', Text),
    Column('synced', Integer, nullable=False, server_default=text('0')),
)

pages_sync_queue = Table(
    'pages_sync_queue',
    metadata,
    Column('queue_id', Integer, primary_key=True, autoincrement=True),
    Column('table_name', String, nullable=False),
    Column('record_id', String, nullable=False),
    Column('operation', String, nullable=False, server_default=text("'INSERT'")),
    Column('sync_status', String, nullable=False, server_default=text("'pending'")),
    Column('retry_count', Integer, nullable=False, server_default=text('0')),
    Column('created_at', Text, nullable=False),
    Column('synced_at', Text),
)

pages_sync_log = Table(
    'pages_sync_log',
    metadata,
    Column('log_id', Integer, primary_key=True, autoincrement=True),
    Column('records_pushed', Integer, nullable=False, server_default=text('0')),
    Column('model_files_pulled', Integer, nullable=False, server_default=text('0')),
    Column('sync_status', String, nullable=False),
    Column('error_message', Text),
    Column('synced_at', Text, nullable=False),
)


def create_engine_for(database_url: str):
    """Create a SQLAlchemy engine with DB-appropriate connection options."""
    options = (
        {'connect_args': {'check_same_thread': False}}
        if database_url.startswith('sqlite')
        else {'pool_pre_ping': True}
    )
    return create_engine(database_url, future=True, **options)