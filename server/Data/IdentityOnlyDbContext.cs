using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace server.Data;

public class IdentityOnlyDbContext : IdentityDbContext<IdentityUser>
{
    public IdentityOnlyDbContext(DbContextOptions<IdentityOnlyDbContext> options)
        : base(options) { }
}
