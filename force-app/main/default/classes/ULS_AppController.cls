/**
 * User & License Snapshot
 *
 * Copyright (c) 2026 Jyotishko Roy (https://orcid.org/0009-0000-2837-4731)
 * Licensed under the MIT License - see LICENSE file in the project root.
 */
public with sharing class ULS_AppController {

    public class Info {
        @AuraEnabled public String version;
        @AuraEnabled public String apiVersion;
        @AuraEnabled public Boolean sandbox;
        @AuraEnabled public String orgId;
        @AuraEnabled public String userId;
        @AuraEnabled public String username;
    }

    public class Summary {
        @AuraEnabled public Integer activeUsers;
        @AuraEnabled public Integer inactiveUsers;
        @AuraEnabled public Integer totalUsers;
        @AuraEnabled public Integer profiles;
        @AuraEnabled public Integer licenses;
        @AuraEnabled public String loginTrendStatus; // OK / UNAVAILABLE
        @AuraEnabled public String loginTrendMessage;
    }

    public class LicenseRow {
        @AuraEnabled public String name;
        @AuraEnabled public Integer total;
        @AuraEnabled public Integer used;
        @AuraEnabled public Integer remaining;
        @AuraEnabled public Decimal pctUsed;
    }

    public class ProfileRow {
        @AuraEnabled public String name;
        @AuraEnabled public Integer activeUsers;
    }

    public class UserRow {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String username;
        @AuraEnabled public String profileName;
        @AuraEnabled public Datetime lastLoginDate;
        @AuraEnabled public String userType;
        @AuraEnabled public String email;
    }

    public class LoginTrendPoint {
        @AuraEnabled public Date day;
        @AuraEnabled public Integer logins;
        @AuraEnabled public Integer uniqueUsers;
    }

    @AuraEnabled(cacheable=true)
    public static Info getInfo() {
        Info i = new Info();
        i.version = '0.1.0';
        i.apiVersion = '55.0';
        i.sandbox = [SELECT IsSandbox FROM Organization LIMIT 1].IsSandbox;
        i.orgId = UserInfo.getOrganizationId();
        i.userId = UserInfo.getUserId();
        i.username = UserInfo.getUserName();
        return i;
    }

    @AuraEnabled(cacheable=true)
    public static Summary getSummary() {
        Summary s = new Summary();
        s.activeUsers = Database.countQuery('SELECT COUNT() FROM User WHERE IsActive = true');
        s.inactiveUsers = Database.countQuery('SELECT COUNT() FROM User WHERE IsActive = false');
        s.totalUsers = s.activeUsers + s.inactiveUsers;
        s.profiles = Database.countQuery('SELECT COUNT() FROM Profile');
        s.licenses = Database.countQuery('SELECT COUNT() FROM UserLicense');

        // LoginHistory access is permission-sensitive: detect availability without failing the whole UI.
        try {
            Integer c = Database.countQuery('SELECT COUNT() FROM LoginHistory WHERE LoginTime = LAST_N_DAYS:7');
            s.loginTrendStatus = 'OK';
            s.loginTrendMessage = 'LoginHistory accessible.';
        } catch (Exception ex) {
            s.loginTrendStatus = 'UNAVAILABLE';
            s.loginTrendMessage = 'Login trends unavailable: ' + ex.getMessage();
        }
        return s;
    }

    @AuraEnabled(cacheable=true)
    public static List<LicenseRow> getLicenses() {
        List<LicenseRow> out = new List<LicenseRow>();
        for (UserLicense ul : [SELECT Name, TotalLicenses, UsedLicenses FROM UserLicense ORDER BY Name]) {
            LicenseRow r = new LicenseRow();
            r.name = ul.Name;
            r.total = ul.TotalLicenses == null ? 0 : Integer.valueOf(ul.TotalLicenses);
            r.used = ul.UsedLicenses == null ? 0 : Integer.valueOf(ul.UsedLicenses);
            r.remaining = Math.max(0, r.total - r.used);
            r.pctUsed = (r.total == 0) ? 0 : (Decimal.valueOf(r.used) / Decimal.valueOf(r.total)) * 100;
            out.add(r);
        }
        return out;
    }

    @AuraEnabled(cacheable=true)
    public static List<ProfileRow> getProfiles() {
        List<ProfileRow> out = new List<ProfileRow>();
        for (AggregateResult ar : [
            SELECT Profile.Name n, COUNT(Id) c
            FROM User
            WHERE IsActive = true
            GROUP BY Profile.Name
            ORDER BY COUNT(Id) DESC
        ]) {
            ProfileRow r = new ProfileRow();
            r.name = (String) ar.get('n');
            r.activeUsers = (Integer) ar.get('c');
            out.add(r);
        }
        return out;
    }

    @AuraEnabled(cacheable=true)
    public static List<UserRow> getRecentActiveUsers(Integer limitSize) {
        Integer lim = (limitSize == null || limitSize <= 0) ? 50 : Math.min(200, limitSize);
        List<UserRow> out = new List<UserRow>();

        for (User u : [
            SELECT Id, Name, Username, Email, UserType, LastLoginDate, Profile.Name
            FROM User
            WHERE IsActive = true
            ORDER BY LastLoginDate DESC NULLS LAST
            LIMIT :lim
        ]) {
            UserRow r = new UserRow();
            r.id = u.Id;
            r.name = u.Name;
            r.username = u.Username;
            r.email = u.Email;
            r.userType = u.UserType;
            r.lastLoginDate = u.LastLoginDate;
            r.profileName = u.Profile == null ? null : u.Profile.Name;
            out.add(r);
        }
        return out;
    }

    @AuraEnabled(cacheable=true)
    public static List<LoginTrendPoint> getLoginTrends(Integer days) {
        Integer d = (days == null || days <= 0) ? 30 : Math.min(90, days);

        List<LoginTrendPoint> out = new List<LoginTrendPoint>();
        try {
            for (AggregateResult ar : [
                SELECT CALENDAR_DATE(LoginTime) day,
                       COUNT(Id) logins,
                       COUNT_DISTINCT(UserId) uniques
                FROM LoginHistory
                WHERE LoginTime = LAST_N_DAYS :d
                GROUP BY CALENDAR_DATE(LoginTime)
                ORDER BY CALENDAR_DATE(LoginTime)
            ]) {
                LoginTrendPoint p = new LoginTrendPoint();
                p.day = (Date) ar.get('day');
                p.logins = (Integer) ar.get('logins');
                p.uniqueUsers = (Integer) ar.get('uniques');
                out.add(p);
            }
        } catch (Exception ex) {
            // Return empty series on permission issues; caller uses summary message
            return new List<LoginTrendPoint>();
        }
        return out;
    }
}
