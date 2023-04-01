# Visits

## reset

```sql
SELECT @visits_count := count(ip), @visits_total := sum(view) FROM list_visits;
TRUNCATE list_visits;
INSERT INTO list_visits (ip,view) VALUES (0,@visits_total);
```
