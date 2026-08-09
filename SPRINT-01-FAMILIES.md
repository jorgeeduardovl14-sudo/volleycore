# VolleyCore Release Checklist

## Authentication

- [ ] Admin login works.
- [ ] Guardian login works.
- [ ] Athlete login works.
- [ ] Refresh preserves the session.
- [ ] Logout works.

## Families

- [ ] Dashboard counts families independently from users.
- [ ] A family can contain multiple users.
- [ ] A family can contain multiple players.
- [ ] A second user linking to the same player does not create another family.
- [ ] Duplicate families can be merged.

## Players

- [ ] All linked players appear.
- [ ] Each player profile opens independently.
- [ ] Multiple categories are saved and displayed.
- [ ] Existing single-category records remain compatible.

## Real time

- [ ] New link request appears without refresh.
- [ ] Approval appears in the family portal without refresh.
- [ ] Linked player appears without refresh.

## Regression

- [ ] Application does not remain on `Cargando sesión`.
- [ ] Categories still load.
- [ ] Events still load.
- [ ] Training schedules still load.
- [ ] Firestore permissions remain correct.
