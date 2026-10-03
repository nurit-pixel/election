-- ⚠️ איפוס משתמשים: מוחק את כל המשתמשים וכל מה שתלוי בהם — הימורים, ניקוד,
-- היסטוריית הגשות, קבוצות, חברויות ושאלות/תשובות של קבוצות.
-- לא נוגע בתוצאות (טבלת results) ובהגדרות הנעילה.
-- אי אפשר לבטל! להריץ רק אחרי 002 ו-003.

begin;

delete from groups;   -- כולל group_members / group_questions / group_answers (cascade)
delete from players;  -- כולל bets / scores / bet_history (cascade)

commit;

-- בדיקה: הכל צריך להיות 0
select
  (select count(*) from players) as players,
  (select count(*) from bets)    as bets,
  (select count(*) from scores)  as scores,
  (select count(*) from groups)  as groups;
