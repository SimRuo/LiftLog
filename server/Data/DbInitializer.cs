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

    private const string SeedExercisesSql = @"
        IF NOT EXISTS (SELECT 1 FROM Exercises WHERE IsDefault = 1)
        BEGIN
            SET IDENTITY_INSERT Exercises ON;
            INSERT INTO Exercises (Id, Name, Category, IsDefault) VALUES
                (1,  'Bench Press',          'Chest',     1),
                (2,  'Incline Bench Press',  'Chest',     1),
                (3,  'Dumbbell Fly',         'Chest',     1),
                (4,  'Squat',                'Legs',      1),
                (5,  'Leg Press',            'Legs',      1),
                (6,  'Romanian Deadlift',    'Legs',      1),
                (7,  'Leg Curl',             'Legs',      1),
                (8,  'Calf Raise',           'Legs',      1),
                (9,  'Deadlift',             'Back',      1),
                (10, 'Barbell Row',          'Back',      1),
                (11, 'Pull-ups',             'Back',      1),
                (12, 'Lat Pulldown',         'Back',      1),
                (13, 'Seated Cable Row',     'Back',      1),
                (14, 'Overhead Press',       'Shoulders', 1),
                (15, 'Lateral Raise',        'Shoulders', 1),
                (16, 'Face Pull',            'Shoulders', 1),
                (17, 'Barbell Curl',         'Arms',      1),
                (18, 'Tricep Pushdown',      'Arms',      1),
                (19, 'Hammer Curl',          'Arms',      1),
                (20, 'Plank',                'Core',      1);
            SET IDENTITY_INSERT Exercises OFF;
        END
    ";
}
