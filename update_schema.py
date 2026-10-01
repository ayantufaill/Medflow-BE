import os

SCHEMA_PATH = 'prisma/schema.prisma'
APPEND_PATH = 'prisma/a3_tables.prisma'

with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
    schema = f.read()

# Insert cross_branch_restricted into patient
schema = schema.replace(
    'model patient {\n',
    'model patient {\n  cross_branch_restricted Boolean @default(false)\n'
)

with open(APPEND_PATH, 'r', encoding='utf-8') as f:
    append_content = f.read()

schema += '\n' + append_content + '\n'

with open(SCHEMA_PATH, 'w', encoding='utf-8') as f:
    f.write(schema)

print("Schema updated successfully.")
