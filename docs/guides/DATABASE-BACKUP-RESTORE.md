# Database Backup and Restore Runbook

The ERP uses one PostgreSQL database per service. Production backups must cover Gateway, Sales, Inventory, Accounting, HR, Procurement, and Delivery databases.

## Backup

1. Confirm the deployment database secret and destination are managed outside the repository.
2. Create a custom-format dump for each service database:

   ```sh
   pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" --file="erp-<service>-$(date -u +%Y%m%dT%H%M%SZ).dump"
   ```

3. Encrypt the dump at rest and upload it to the approved backup store.
4. Record service, database, timestamp, dump checksum, operator, and retention expiry.
5. Never print `DATABASE_URL` or credentials in CI logs.

## Restore rehearsal

1. Provision an isolated PostgreSQL database with the same major version as production.
2. Restore the dump into the isolated database:

   ```sh
   createdb "$RESTORE_DATABASE"
   pg_restore --clean --if-exists --no-owner --no-privileges \
     --dbname="$RESTORE_DATABASE_URL" "$BACKUP_FILE"
   ```

3. Apply the service's committed Prisma migrations and verify migration status.
4. Start the service against the restored database.
5. Run health, authentication, tenant-isolation, and critical business-flow smoke tests.
6. Compare row counts and key financial invariants, including balanced journals, invoice totals, and stock movement consistency.
7. Record restore duration, recovery point, recovery time, failed checks, and corrective actions.

## Production gate

A backup is not evidence of recoverability until a restore rehearsal succeeds. Production approval requires a dated staging record for every service database, with an owner and recovery-time result.

## Emergency recovery

Freeze writes, announce the incident, select the latest verified backup, restore into an isolated database first, validate invariants, and switch traffic only after approval. Preserve the original database for forensic review; do not overwrite it during the first recovery attempt.
