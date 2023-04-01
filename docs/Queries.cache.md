# Cache

Multi

```sql
INSERT INTO list_cache (word) values
('king'),
('queen')
ON DUPLICATE KEY UPDATE view = view + 1;
```

Single

```sql
INSERT INTO list_cache SET word="king" ON DUPLICATE KEY UPDATE view = view + 1;
```
