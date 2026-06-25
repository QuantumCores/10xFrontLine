using System.ComponentModel.DataAnnotations;

namespace frontLineApi.Contracts.Auth;

public sealed record RequestCodeRequest(
    [Required]
    [EmailAddress]
    [MaxLength(320)]
    string Email);
