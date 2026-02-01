using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using server.Models;

namespace server.Data;

public class LiftLogDbContext : IdentityDbContext<IdentityUser>
{
    public LiftLogDbContext(DbContextOptions<LiftLogDbContext> options) : base(options) { }

    public DbSet<Exercise> Exercises => Set<Exercise>();
    public DbSet<WorkoutSession> WorkoutSessions => Set<WorkoutSession>();
    public DbSet<WorkoutSet> WorkoutSets => Set<WorkoutSet>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Exercise>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(100);
            e.Property(x => x.Category).HasMaxLength(50);
            e.HasIndex(x => x.Name).IsUnique();
            e.HasOne(x => x.CreatedByUser)
                .WithMany()
                .HasForeignKey(x => x.CreatedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<WorkoutSession>(e =>
        {
            e.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.UserId, x.Date });
        });

        builder.Entity<WorkoutSet>(e =>
        {
            e.Property(x => x.Weight).HasColumnType("decimal(7,2)");
            e.HasOne(x => x.WorkoutSession)
                .WithMany(s => s.Sets)
                .HasForeignKey(x => x.WorkoutSessionId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Exercise)
                .WithMany(ex => ex.WorkoutSets)
                .HasForeignKey(x => x.ExerciseId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.WorkoutSessionId, x.ExerciseId });
        });

        SeedExercises(builder);
    }

    private static void SeedExercises(ModelBuilder builder)
    {
        builder.Entity<Exercise>().HasData(
            new Exercise { Id = 1, Name = "Bench Press", Category = "Chest", IsDefault = true },
            new Exercise { Id = 2, Name = "Incline Bench Press", Category = "Chest", IsDefault = true },
            new Exercise { Id = 3, Name = "Dumbbell Fly", Category = "Chest", IsDefault = true },
            new Exercise { Id = 4, Name = "Squat", Category = "Legs", IsDefault = true },
            new Exercise { Id = 5, Name = "Leg Press", Category = "Legs", IsDefault = true },
            new Exercise { Id = 6, Name = "Romanian Deadlift", Category = "Legs", IsDefault = true },
            new Exercise { Id = 7, Name = "Leg Curl", Category = "Legs", IsDefault = true },
            new Exercise { Id = 8, Name = "Calf Raise", Category = "Legs", IsDefault = true },
            new Exercise { Id = 9, Name = "Deadlift", Category = "Back", IsDefault = true },
            new Exercise { Id = 10, Name = "Barbell Row", Category = "Back", IsDefault = true },
            new Exercise { Id = 11, Name = "Pull-ups", Category = "Back", IsDefault = true },
            new Exercise { Id = 12, Name = "Lat Pulldown", Category = "Back", IsDefault = true },
            new Exercise { Id = 13, Name = "Seated Cable Row", Category = "Back", IsDefault = true },
            new Exercise { Id = 14, Name = "Overhead Press", Category = "Shoulders", IsDefault = true },
            new Exercise { Id = 15, Name = "Lateral Raise", Category = "Shoulders", IsDefault = true },
            new Exercise { Id = 16, Name = "Face Pull", Category = "Shoulders", IsDefault = true },
            new Exercise { Id = 17, Name = "Barbell Curl", Category = "Arms", IsDefault = true },
            new Exercise { Id = 18, Name = "Tricep Pushdown", Category = "Arms", IsDefault = true },
            new Exercise { Id = 19, Name = "Hammer Curl", Category = "Arms", IsDefault = true },
            new Exercise { Id = 20, Name = "Plank", Category = "Core", IsDefault = true }
        );
    }
}
