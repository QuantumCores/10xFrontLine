namespace frontLineApi.Configuration;

public sealed class PasswordlessOptions
{
    public int CodeMinutes { get; set; } = 10;

    public string CodePepper { get; set; } = string.Empty;
}
