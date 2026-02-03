#!/bin/sh
set -e

SQLCMD="/opt/mssql-tools18/bin/sqlcmd"

if [ ! -x "$SQLCMD" ]; then
  SQLCMD="/opt/mssql-tools/bin/sqlcmd"
fi

if [ ! -x "$SQLCMD" ]; then
  echo "sqlcmd not found in container"
  exit 1
fi

: "${MSSQL_SA_PASSWORD:?MSSQL_SA_PASSWORD is required}"
: "${MSSQL_DB:=schema_test}"

# Ensure database exists (idempotent)
$SQLCMD -S db -U sa -P "$MSSQL_SA_PASSWORD" -C -b -Q "IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = '$MSSQL_DB') CREATE DATABASE [$MSSQL_DB];"

# Check if schema already exists (using patient table as marker)
HAS_SCHEMA=$($SQLCMD -S db -U sa -P "$MSSQL_SA_PASSWORD" -C -d "$MSSQL_DB" -h -1 -W -Q "SET NOCOUNT ON; SELECT CASE WHEN OBJECT_ID('dbo.patient','U') IS NULL THEN 0 ELSE 1 END")

if [ "$HAS_SCHEMA" = "1" ]; then
  echo "Schema already initialized. Skipping."
  exit 0
fi

# Run schema
$SQLCMD -S db -U sa -P "$MSSQL_SA_PASSWORD" -C -b -d "$MSSQL_DB" -i /init/opendental_schema_create.sql

echo "Schema initialized successfully."
