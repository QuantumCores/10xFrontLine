namespace frontLineApi.Configuration;

public sealed class PasswordlessOptions
{
    public int CodeMinutes { get; set; } = 10;
}
