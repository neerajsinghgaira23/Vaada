#!/bin/bash
set -e
service postgresql start

# Set postgres password and create user/db
su - postgres << 'EOF'
psql -c "DO \$\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'vaada') THEN
      CREATE USER vaada WITH PASSWORD 'vaada123' SUPERUSER;
   END IF;
END
\$\$;"
psql -tc "SELECT 1 FROM pg_database WHERE datname = 'vaadadb'" | grep -q 1 || psql -c "CREATE DATABASE vaadadb OWNER vaada;"
EOF

# Allow connections
CONF=$(ls /etc/postgresql/*/main/postgresql.conf | head -n 1)
HBA=$(ls /etc/postgresql/*/main/pg_hba.conf | head -n 1)

sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$CONF"
sed -i "s/listen_addresses = 'localhost'/listen_addresses = '*'/" "$CONF"

if ! grep -q "host all all 0.0.0.0/0 md5" "$HBA"; then
    echo "host all all 0.0.0.0/0 md5" >> "$HBA"
    echo "host all all ::0/0 md5" >> "$HBA"
    echo "host all all 127.0.0.1/32 trust" >> "$HBA"
fi

service postgresql restart
echo "POSTGRES_READY"
