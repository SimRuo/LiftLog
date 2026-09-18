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
        await connection.ExecuteAsync(SeedCardioActivitiesSql);
        await connection.ExecuteAsync(SeedHyroxSql);
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

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CardioActivities')
        BEGIN
            -- Cardio deliberately does not reuse Exercises/WorkoutSets. A set is
            -- reps x weight, and GetWorkouts sums Weight * Reps as a session's
            -- headline volume — storing a 30-minute 10km run in those columns
            -- would render it as 300 kg on a history card and feed nonsense
            -- into the est. 1RM and volume charts.
            --
            -- Mode decides which numbers an activity even has: 'distance' work
            -- (running, rowing) is measured by pace, 'time' work (jump rope,
            -- circuits) only by how long it lasted. The logging form asks for
            -- one or the other off the back of this.
            CREATE TABLE CardioActivities (
                Id              INT IDENTITY(1,1) PRIMARY KEY,
                Name            NVARCHAR(100) NOT NULL,
                Mode            NVARCHAR(20)  NOT NULL,
                IsDefault       BIT           NOT NULL DEFAULT 0,
                CreatedByUserId NVARCHAR(450) NULL
                    REFERENCES AspNetUsers(Id) ON DELETE SET NULL
            );
            CREATE UNIQUE INDEX IX_CardioActivities_Name ON CardioActivities(Name);
        END

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CardioSessions')
        BEGIN
            -- Distance in whole metres and duration in whole seconds: both are
            -- exact integers, so pace arithmetic can't accumulate the rounding
            -- error that storing kilometres as a decimal would invite.
            CREATE TABLE CardioSessions (
                Id               INT IDENTITY(1,1) PRIMARY KEY,
                UserId           NVARCHAR(450) NOT NULL
                    REFERENCES AspNetUsers(Id) ON DELETE CASCADE,
                CardioActivityId INT NOT NULL
                    REFERENCES CardioActivities(Id) ON DELETE NO ACTION,
                Date             DATETIME2     NOT NULL,
                DurationSeconds  INT           NOT NULL,
                DistanceMeters   INT           NULL,
                -- Rate of perceived exertion, 1-10. Optional, but it is what
                -- makes a pace trend readable: the same pace at a lower effort
                -- is progress, a faster one at maximum effort may not be.
                Rpe              TINYINT       NULL,
                Notes            NVARCHAR(MAX) NULL,
                CreatedAt        DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
            );
            CREATE INDEX IX_CardioSessions_UserId_Date ON CardioSessions(UserId, Date);
            CREATE INDEX IX_CardioSessions_ActivityId ON CardioSessions(CardioActivityId);
        END

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CardioActivitySteps')
        BEGIN
            -- The shape of a circuit: an ordered list of stations, each with
            -- what it prescribes. This is a template, not a record of anything
            -- done — it's what makes two attempts at the same workout
            -- comparable, which is the entire point of logging a fixed format.
            --
            -- Two references into CardioActivities, doing different jobs:
            -- CardioActivityId is the circuit that owns the step, and
            -- StepActivityId is the station being performed. Only the former
            -- cascades; a station is shared and must never be deleted out from
            -- under a circuit that uses it.
            CREATE TABLE CardioActivitySteps (
                Id                   INT IDENTITY(1,1) PRIMARY KEY,
                CardioActivityId     INT NOT NULL
                    REFERENCES CardioActivities(Id) ON DELETE CASCADE,
                [Order]              INT NOT NULL,
                StepActivityId       INT NOT NULL
                    REFERENCES CardioActivities(Id) ON DELETE NO ACTION,
                -- Whichever of these the station is measured in. Laps and reps
                -- are a third measure that distance can't stand in for: 10 sled
                -- laps means nothing in metres without a track length, and 100
                -- wall balls isn't a distance at all.
                TargetDistanceMeters INT NULL,
                TargetReps           INT NULL
            );
            CREATE INDEX IX_CardioActivitySteps_Activity
                ON CardioActivitySteps(CardioActivityId, [Order]);
        END

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CardioSegments')
        BEGIN
            -- What actually happened, step by step. DurationSeconds is nullable
            -- on purpose: the session's own total is the required number, and a
            -- split is filled in only for the stations worth remembering.
            CREATE TABLE CardioSegments (
                Id               INT IDENTITY(1,1) PRIMARY KEY,
                CardioSessionId  INT NOT NULL
                    REFERENCES CardioSessions(Id) ON DELETE CASCADE,
                [Order]          INT NOT NULL,
                CardioActivityId INT NOT NULL
                    REFERENCES CardioActivities(Id) ON DELETE NO ACTION,
                DurationSeconds  INT NULL,
                DistanceMeters   INT NULL,
                Reps             INT NULL
            );
            CREATE INDEX IX_CardioSegments_Session
                ON CardioSegments(CardioSessionId, [Order]);
        END

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PushSubscriptions')
        BEGIN
            CREATE TABLE PushSubscriptions (
                Id        INT IDENTITY(1,1) PRIMARY KEY,
                UserId    NVARCHAR(450)  NOT NULL
                    REFERENCES AspNetUsers(Id) ON DELETE CASCADE,
                -- One row per browser, keyed by the endpoint URL — the only
                -- stable identifier a browser hands out. 500 leaves generous
                -- room over the ~200 characters FCM and Mozilla actually issue,
                -- while staying well inside the 1700-byte index key limit so it
                -- can be indexed directly.
                Endpoint  NVARCHAR(500) NOT NULL,
                P256dh    NVARCHAR(200) NOT NULL,
                Auth      NVARCHAR(100) NOT NULL,
                CreatedAt DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
            );
            CREATE UNIQUE INDEX IX_PushSubscriptions_Endpoint
                ON PushSubscriptions(Endpoint);
            CREATE INDEX IX_PushSubscriptions_UserId ON PushSubscriptions(UserId);
        END

        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ActiveWorkouts')
        BEGIN
            -- A workout in progress lives in the browser's localStorage until
            -- it's finished, so the server would otherwise have no idea one is
            -- open. This is the device telling it, purely so the reminder
            -- worker has something to scan. One open workout per user, hence
            -- UserId as the key rather than a surrogate.
            CREATE TABLE ActiveWorkouts (
                UserId     NVARCHAR(450) NOT NULL PRIMARY KEY
                    REFERENCES AspNetUsers(Id) ON DELETE CASCADE,
                StartedAt  DATETIME2 NOT NULL,
                RemindedAt DATETIME2 NULL,
                Reminders  INT       NOT NULL DEFAULT 0
            );
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

    // Same insert-what's-missing rule as the exercises above, so this list can
    // grow later and reach databases that already ran it.
    private const string SeedCardioActivitiesSql = @"
        INSERT INTO CardioActivities (Name, Mode, IsDefault)
        SELECT v.Name, v.Mode, 1
        FROM (VALUES
            ('Running',           'distance'),
            ('Treadmill',         'distance'),
            ('Walking',           'distance'),
            ('Hiking',            'distance'),
            ('Cycling',           'distance'),
            ('Stationary Bike',   'distance'),
            ('Rowing',            'distance'),
            ('Ski Erg',           'distance'),
            ('Swimming',          'distance'),
            ('Elliptical',        'distance'),
            ('Assault Bike',      'time'),
            ('Stair Climber',     'time'),
            ('Jump Rope',         'time'),
            ('Circuit Training',  'time'),
            ('Bag Work',          'time'),
            ('Sled Push',         'time'),
            ('Kettlebell Swings', 'time'),
            ('Sauna',             'time')
        ) AS v(Name, Mode)
        WHERE NOT EXISTS (SELECT 1 FROM CardioActivities c WHERE c.Name = v.Name);
    ";

    // The Hyrox race format, as a circuit anyone can log against.
    //
    // Three steps, each skippable on its own: the stations it needs, the
    // circuit itself, then the ordered steps — which are only written if the
    // circuit has none, so someone who has edited theirs doesn't get it reset
    // on the next deploy.
    private const string SeedHyroxSql = @"
        INSERT INTO CardioActivities (Name, Mode, IsDefault)
        SELECT v.Name, v.Mode, 1
        FROM (VALUES
            ('Sled Pull',           'time'),
            ('Burpee Broad Jumps',  'time'),
            ('Farmers Carry',       'time'),
            ('Sandbag Lunges',      'time'),
            ('Wall Balls',          'time')
        ) AS v(Name, Mode)
        WHERE NOT EXISTS (SELECT 1 FROM CardioActivities c WHERE c.Name = v.Name);

        INSERT INTO CardioActivities (Name, Mode, IsDefault)
        SELECT 'Hyrox', 'circuit', 1
        WHERE NOT EXISTS (SELECT 1 FROM CardioActivities c WHERE c.Name = 'Hyrox');

        IF NOT EXISTS (
            SELECT 1 FROM CardioActivitySteps s
            INNER JOIN CardioActivities a ON a.Id = s.CardioActivityId
            WHERE a.Name = 'Hyrox')
        BEGIN
            INSERT INTO CardioActivitySteps
                (CardioActivityId, [Order], StepActivityId, TargetDistanceMeters, TargetReps)
            SELECT circuit.Id, v.StepOrder, station.Id, v.Distance, v.Reps
            FROM (VALUES
                ( 0, 'Running',            1000, NULL),
                ( 1, 'Ski Erg',            1000, NULL),
                ( 2, 'Running',            1000, NULL),
                ( 3, 'Sled Push',            50, NULL),
                ( 4, 'Running',            1000, NULL),
                ( 5, 'Sled Pull',            50, NULL),
                ( 6, 'Running',            1000, NULL),
                ( 7, 'Burpee Broad Jumps',   80, NULL),
                ( 8, 'Running',            1000, NULL),
                ( 9, 'Rowing',             1000, NULL),
                (10, 'Running',            1000, NULL),
                (11, 'Farmers Carry',       200, NULL),
                (12, 'Running',            1000, NULL),
                (13, 'Sandbag Lunges',      100, NULL),
                (14, 'Running',            1000, NULL),
                (15, 'Wall Balls',         NULL,  100)
            ) AS v(StepOrder, StepName, Distance, Reps)
            INNER JOIN CardioActivities station ON station.Name = v.StepName
            CROSS JOIN (SELECT TOP 1 Id FROM CardioActivities WHERE Name = 'Hyrox') circuit;
        END
    ";
}
