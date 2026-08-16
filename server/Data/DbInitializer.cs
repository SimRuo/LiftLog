using Dapper;
using Microsoft.Data.SqlClient;

namespace server.Data;

public static class DbInitializer
{
    public static async Task InitializeAsync(string connectionString)
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();

        await connection.ExecuteAsync(CreateTablesSql);
        await connection.ExecuteAsync(SeedExercisesSql);
    }

    private const string CreateTablesSql = @"
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Exercises')
        BEGIN
            CREATE TABLE Exercises (
                Id              INT IDENTITY(1,1) PRIMARY KEY,
                Name            NVARCHAR(100) NOT NULL,
                Category        NVARCHAR(50)  NOT NULL,
                IsDefault       BIT           NOT NULL DEFAULT 0,
                CreatedByUserId NVARCHAR(450) NULL
                    REFERENCES AspNetUsers(Id) ON DELETE SET NULL
            );
            CREATE UNIQUE INDEX IX_Exercises_Name ON Exercises(Name);
        END

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkoutPlans')
        BEGIN
            CREATE TABLE WorkoutPlans (
                Id        INT IDENTITY(1,1) PRIMARY KEY,
                UserId    NVARCHAR(450) NOT NULL
                    REFERENCES AspNetUsers(Id) ON DELETE CASCADE,
                Name      NVARCHAR(100) NOT NULL,
                CreatedAt DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
            );
        END

        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('WorkoutPlans') AND name = 'IsActive')
            ALTER TABLE WorkoutPlans ADD IsActive BIT NOT NULL DEFAULT 0;

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PlanDays')
        BEGIN
            CREATE TABLE PlanDays (
                Id            INT IDENTITY(1,1) PRIMARY KEY,
                WorkoutPlanId INT NOT NULL
                    REFERENCES WorkoutPlans(Id) ON DELETE CASCADE,
                Name          NVARCHAR(100) NOT NULL,
                [Order]       INT NOT NULL
            );
        END

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PlanExercises')
        BEGIN
            CREATE TABLE PlanExercises (
                Id         INT IDENTITY(1,1) PRIMARY KEY,
                PlanDayId  INT NOT NULL
                    REFERENCES PlanDays(Id) ON DELETE CASCADE,
                ExerciseId INT NOT NULL
                    REFERENCES Exercises(Id) ON DELETE NO ACTION,
                [Order]    INT NOT NULL,
                Sets       INT NOT NULL,
                Reps       NVARCHAR(20) NOT NULL,
                Weight     DECIMAL(7,2) NOT NULL DEFAULT 0,
                Notes      NVARCHAR(MAX) NULL
            );
        END

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkoutSessions')
        BEGIN
            CREATE TABLE WorkoutSessions (
                Id        INT IDENTITY(1,1) PRIMARY KEY,
                UserId    NVARCHAR(450) NOT NULL
                    REFERENCES AspNetUsers(Id) ON DELETE CASCADE,
                Date      DATETIME2     NOT NULL,
                Notes     NVARCHAR(MAX) NULL,
                CreatedAt DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
                PlanDayId INT NULL
                    REFERENCES PlanDays(Id) ON DELETE NO ACTION,
                IsRestDay BIT NOT NULL DEFAULT 0
            );
            CREATE INDEX IX_WorkoutSessions_UserId_Date
                ON WorkoutSessions(UserId, Date);
        END

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkoutSets')
        BEGIN
            CREATE TABLE WorkoutSets (
                Id               INT IDENTITY(1,1) PRIMARY KEY,
                WorkoutSessionId INT NOT NULL
                    REFERENCES WorkoutSessions(Id) ON DELETE CASCADE,
                ExerciseId       INT NOT NULL
                    REFERENCES Exercises(Id) ON DELETE NO ACTION,
                SetNumber        INT NOT NULL,
                Reps             INT NOT NULL,
                Weight           DECIMAL(7,2) NOT NULL,
                Notes            NVARCHAR(MAX) NULL
            );
            CREATE INDEX IX_WorkoutSets_SessionId_ExerciseId
                ON WorkoutSets(WorkoutSessionId, ExerciseId);
        END
    ";

    // Insert-what's-missing rather than seed-once-if-empty.
    //
    // The original guard was `IF NOT EXISTS (... WHERE IsDefault = 1)`, which
    // means any database that already ran it will never see a new default
    // again — so growing this list would have been a no-op everywhere it
    // mattered. Matching per name instead makes the list a live source of
    // truth that can be extended.
    //
    // No IDENTITY_INSERT either: user-created exercises take identity values
    // from 21 up, so hardcoding ids for new defaults would collide with them.
    private const string SeedExercisesSql = @"
        INSERT INTO Exercises (Name, Category, IsDefault)
        SELECT v.Name, v.Category, 1
        FROM (VALUES
            ('Bench Press',                'Chest'),
            ('Incline Bench Press',        'Chest'),
            ('Decline Bench Press',        'Chest'),
            ('Dumbbell Bench Press',       'Chest'),
            ('Incline Dumbbell Press',     'Chest'),
            ('Chest Press Machine',        'Chest'),
            ('Incline Chest Press Machine','Chest'),
            ('Dumbbell Fly',               'Chest'),
            ('Cable Fly',                  'Chest'),
            ('Pec Deck',                   'Chest'),
            ('Dumbbell Pullover',          'Chest'),
            ('Push-ups',                   'Chest'),
            ('Chest Dip',                  'Chest'),

            ('Deadlift',                   'Back'),
            ('Barbell Row',                'Back'),
            ('Pendlay Row',                'Back'),
            ('Dumbbell Row',               'Back'),
            ('T-Bar Row',                  'Back'),
            ('Chest Supported Row',        'Back'),
            ('Seated Cable Row',           'Back'),
            ('Machine Row',                'Back'),
            ('Lat Pulldown',               'Back'),
            ('Machine Lat Pulldown',       'Back'),
            ('Straight Arm Pulldown',      'Back'),
            ('Pull-ups',                   'Back'),
            ('Chin-ups',                   'Back'),
            ('Back Extension',             'Back'),
            ('Shrug',                      'Back'),

            ('Squat',                      'Legs'),
            ('Front Squat',                'Legs'),
            ('Hack Squat',                 'Legs'),
            ('Leg Press',                  'Legs'),
            ('Single Leg Press',           'Legs'),
            ('Leg Extension',              'Legs'),
            ('Leg Curl',                   'Legs'),
            ('Seated Leg Curl',            'Legs'),
            ('Lying Leg Curl',             'Legs'),
            ('Romanian Deadlift',          'Legs'),
            ('Bulgarian Split Squat',      'Legs'),
            ('Lunge',                      'Legs'),
            ('Hip Thrust',                 'Legs'),
            ('Good Morning',               'Legs'),
            ('Calf Raise',                 'Legs'),
            ('Seated Calf Raise',          'Legs'),

            ('Overhead Press',             'Shoulders'),
            ('Seated Dumbbell Press',      'Shoulders'),
            ('Machine Shoulder Press',     'Shoulders'),
            ('Lateral Raise',              'Shoulders'),
            ('Cable Lateral Raise',        'Shoulders'),
            ('Rear Delt Fly',              'Shoulders'),
            ('Face Pull',                  'Shoulders'),
            ('Upright Row',                'Shoulders'),

            ('Barbell Curl',               'Arms'),
            ('EZ Bar Curl',                'Arms'),
            ('Dumbbell Curl',              'Arms'),
            ('Incline Dumbbell Curl',      'Arms'),
            ('Hammer Curl',                'Arms'),
            ('Cable Curl',                 'Arms'),
            ('Preacher Curl',              'Arms'),
            ('Tricep Pushdown',            'Arms'),
            ('Overhead Tricep Extension',  'Arms'),
            ('Skullcrusher',               'Arms'),
            ('Close Grip Bench Press',     'Arms'),
            ('Tricep Dip',                 'Arms'),

            ('Plank',                      'Core'),
            ('Side Plank',                 'Core'),
            ('Crunch',                     'Core'),
            ('Cable Crunch',               'Core'),
            ('Hanging Leg Raise',          'Core'),
            ('Ab Wheel Rollout',           'Core')
        ) AS v(Name, Category)
        WHERE NOT EXISTS (SELECT 1 FROM Exercises e WHERE e.Name = v.Name);
    ";
}
