-- Individual roles user migration
UPDATE "V_User" SET roles = '["individual"]'
WHERE osid IN (
    SELECT "user".osid FROM "V_User" as "user"
    LEFT JOIN "V_User_Org" as "userOrg" ON "user".osid = "userOrg"."userId"
    WHERE "userOrg"."userId" IS NULL
);

-- User other roles migration
UPDATE "V_User"
SET roles = "V_User_Org".roles
FROM "V_User_Org"
WHERE "V_User".osid = "V_User_Org"."userId";

