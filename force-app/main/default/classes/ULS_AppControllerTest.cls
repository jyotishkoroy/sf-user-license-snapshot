@IsTest
private class ULS_AppControllerTest {
    @IsTest
    static void testInfoAndSummary() {
        Test.startTest();
        ULS_AppController.Info i = ULS_AppController.getInfo();
        ULS_AppController.Summary s = ULS_AppController.getSummary();
        Test.stopTest();

        System.assertEquals('0.1.0', i.version);
        System.assertNotEquals(null, i.orgId);
        System.assert(s.totalUsers >= 0);
    }

    @IsTest
    static void testLicensesAndProfilesAndUsers() {
        Test.startTest();
        List<ULS_AppController.LicenseRow> l = ULS_AppController.getLicenses();
        List<ULS_AppController.ProfileRow> p = ULS_AppController.getProfiles();
        List<ULS_AppController.UserRow> u = ULS_AppController.getRecentActiveUsers(10);
        Test.stopTest();

        System.assertNotEquals(null, l);
        System.assertNotEquals(null, p);
        System.assertNotEquals(null, u);
    }
}
