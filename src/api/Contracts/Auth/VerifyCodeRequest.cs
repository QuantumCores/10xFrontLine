using System.ComponentModel.DataAnnotations;

namespace frontLineApi.Contracts.Auth;

public sealed record VerifyCodeRequest(
    [Required]
    [EmailAddress]
    [MaxLength(320)]
    string Email,
    [Required]
    [StringLength(16, MinimumLength = 4)]
    string Code);
